import path = require('path')
import {
  Behavior,
  CfnDistribution,
  CloudFrontAllowedMethods,
  CloudFrontWebDistribution,
  LambdaEdgeEventType,
  OriginAccessIdentity,
  SecurityPolicyProtocol,
  SSLMethod,
  ViewerCertificate,
  ViewerProtocolPolicy,
} from '@aws-cdk/aws-cloudfront'
import { PolicyStatement, Effect, CanonicalUserPrincipal } from '@aws-cdk/aws-iam'
import { Function, Code, Runtime } from '@aws-cdk/aws-lambda'
import { CnameRecord, HostedZone } from '@aws-cdk/aws-route53'
import { Bucket, BucketAccessControl } from '@aws-cdk/aws-s3'
import { StringParameter } from '@aws-cdk/aws-ssm'
import * as cdk from '@aws-cdk/core'
import { TransclusionLambda, SpaRedirectionLambda } from '@ndlib/ndlib-cdk'
import { CertificateHelper } from './certificate-helper'
import { OverrideStages } from './config'

export interface IStaticHostStackProps extends cdk.StackProps {
  /**
   * AWS environment being deployed to. ("dev" or "prod", referring to testlibnd or libnd respectively)
   */
  readonly contextEnvName: string

  /**
   * Application environment, or the stage of a pipeline. Used for naming stacks, hostname, etc.
   */
  readonly stage: string

  /**
   * Name of the stack without the -stage suffix.
   */
  readonly stackNamePrefix: string

  /**
   * If provided, this will be used as the prefix in the hostname. If not provided, the stack name will be used.
   */
  readonly hostnamePrefix?: string

  /**
   * Should create a DNS record in route53 for the generated hostname. (hostnamePrefix.domainName)
   * Generally this should only be done with domains other than library.nd.edu.
   */
  readonly createDns?: boolean

  /**
   * Adds a Lambda@Edge to the cloudfront which handles redirecting to index.html files as needed by SPAs.
   */
  readonly createSpaRedirects?: boolean

  /**
   * If true, a Lambda@Edge will be created that handles SSI transclusion for .shtml files.
   */
  readonly supportHtmlIncludes?: boolean

  /**
   * Stack name to import domain name and SSL certificate from.
   */
  readonly domainStackName?: string

  /**
   * If provided, use custom domain name and certificate for this project instead of importing from domainStackName.
   */
  readonly domainOverride?: {
    /**
     * Domain Name to use instead of specifying a domainStack. Should match certificate's domain!
     */
    readonly domainName: string

    /**
     * Path in parameter store that contains the ARN of the SSL certificate to use.
     */
    readonly certificateArnParam: string

    /**
     * Represents the stages in which the domain override is applied.
     */
    readonly stages: OverrideStages
  }

  /**
   * Root page to be served.
   */
  readonly indexFilename?: string

  /**
   * How long to cache origin responses for (defaults to 1 day)
   */
  readonly cacheTtl?: cdk.Duration

  /**
   * Error page configuration for the CloudFront distribution.
   */
  readonly errorConfig?: CfnDistribution.CustomErrorResponseProperty[]
}

export class StaticHostStack extends cdk.Stack {
  /**
   * The S3 bucket that will hold website contents.
   */
  public readonly bucket: Bucket

  /**
   * The S3 bucket where log files are stored.
   */
  public readonly logBucket: Bucket

  /**
   * The cloudfront distribution.
   */
  public readonly cloudfront: CloudFrontWebDistribution

  /**
   * The cloudfront distribution domain name.
   */
  public readonly hostname: string

  /**
   * Lambda used for redirecting certain routes with Cloudfront.
   */
  public readonly spaRedirectionLambda?: SpaRedirectionLambda

  /**
   * Lambda used for .shtml file transclusion.
   */
  public readonly transclusionLambda?: TransclusionLambda

  constructor(scope: cdk.Construct, id: string, props: IStaticHostStackProps) {
    super(scope, id, props)

    // Find the domain name and certificate to use
    const certHelper = new CertificateHelper(this, 'CertHelper', {
      stage: props.stage,
      domainStackName: props.domainStackName,
      domainOverride: props.domainOverride,
    })

    // Use stack name if no hostname prefix is provided
    let prefix = props.hostnamePrefix || props.stackNamePrefix
    if (props.stage !== 'prod') {
      // For non-prod stacks, add the stage to the end of the name.
      prefix += `-${props.stage}`
    }
    this.hostname = `${prefix}.${certHelper.domainName}`

    // Create buckets for holding logs and the site contents
    this.logBucket = new Bucket(this, 'LogBucket', {
      accessControl: BucketAccessControl.LOG_DELIVERY_WRITE,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      lifecycleRules: [
        {
          enabled: true,
          expiration: cdk.Duration.days(365 * 10),
          noncurrentVersionExpiration: cdk.Duration.days(1),
        },
      ],
    })

    this.bucket = new Bucket(this, 'SiteBucket', {
      serverAccessLogsBucket: this.logBucket,
      serverAccessLogsPrefix: `s3/${this.hostname}/`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    // Create OAI so CloudFront can access bucket files
    const oai = new OriginAccessIdentity(this, 'OriginAccessIdentity', {
      comment: `Static assets in ${this.stackName}`,
    })
    this.bucket.addToResourcePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['s3:GetBucket*', 's3:List*', 's3:GetObject*'],
        resources: [this.bucket.bucketArn, this.bucket.bucketArn + '/*'],
        principals: [new CanonicalUserPrincipal(oai.cloudFrontOriginAccessIdentityS3CanonicalUserId)],
      }),
    )

    // Behaviors for cloudfront
    // Define behaviors before cloudfront so we can append to it conditionally
    const originBehaviors: Behavior[] = []
    const cacheTtl = props.contextEnvName === 'dev' ? cdk.Duration.seconds(0) : props.cacheTtl || cdk.Duration.days(1)

    // Create edge lambdas (if needed)
    if (props.createSpaRedirects) {
      this.spaRedirectionLambda = new SpaRedirectionLambda(this, 'SPARedirectionLambda', {
        isDefaultBehavior: true,
        defaultTtl: cacheTtl,
      })
    } else {
      // Default behavior is required
      originBehaviors.push(
        {
          allowedMethods: CloudFrontAllowedMethods.GET_HEAD_OPTIONS,
          compress: true,
          defaultTtl: cacheTtl,
          isDefaultBehavior: true,
        },
      )
    }

    if (props.supportHtmlIncludes) {
      this.transclusionLambda = new TransclusionLambda(this, 'TransclusionLambda', {
        originBucket: this.bucket,
        isDefaultBehavior: false,
        defaultTtl: cacheTtl,
      })
      originBehaviors.push(this.transclusionLambda.behavior)
    }

    // Won't work right if it starts with slash. It's an easy mistake to make so just handle it here
    let indexPath = props.indexFilename || 'index.html'
    if (indexPath.startsWith('/')) {
      indexPath = indexPath.substring(1)
    }

    this.cloudfront = new CloudFrontWebDistribution(this, 'Distribution', {
      comment: this.hostname,
      defaultRootObject: indexPath,
      errorConfigurations: props.errorConfig || [
        {
          errorCode: 403,
          responseCode: 403,
          responsePagePath: '/' + indexPath,
          errorCachingMinTtl: 300,
        },
        {
          errorCode: 404,
          responseCode: 404,
          responsePagePath: '/' + indexPath,
          errorCachingMinTtl: 300,
        },
      ],
      loggingConfig: {
        bucket: this.logBucket,
        includeCookies: true,
        prefix: `web/${this.hostname}/`,
      },
      originConfigs: [
        {
          s3OriginSource: {
            s3BucketSource: this.bucket,
            originAccessIdentity: oai,
          },
          behaviors: originBehaviors,
        },
      ],
      viewerCertificate: ViewerCertificate.fromAcmCertificate(certHelper.websiteCertificate, {
        aliases: [this.hostname],
        securityPolicy: SecurityPolicyProtocol.TLS_V1_1_2016,
        sslMethod: SSLMethod.SNI,
      }),
      viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    })

    // Create DNS record (conditionally)
    if (props.createDns) {
      new CnameRecord(this, 'ServiceCNAME', {
        recordName: this.hostname,
        comment: this.hostname,
        domainName: this.cloudfront.distributionDomainName,
        zone: HostedZone.fromHostedZoneAttributes(this, 'ImportedHostedZone', {
          hostedZoneId: cdk.Fn.importValue(`${props.domainStackName}:Zone`),
          zoneName: certHelper.domainName,
        }),
        ttl: cdk.Duration.minutes(15),
      })
    }

    new StringParameter(this, 'BucketParameter', {
      parameterName: `/all/stacks/${this.stackName}/site-bucket-name`,
      description: 'Bucket where the stack website deploys to.',
      stringValue: this.bucket.bucketName,
    })

    new StringParameter(this, 'DistributionParameter', {
      parameterName: `/all/stacks/${this.stackName}/distribution-id`,
      description: 'ID of the CloudFront distribution.',
      stringValue: this.cloudfront.distributionId,
    })

    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: this.cloudfront.distributionDomainName,
      description: 'The cloudfront distribution domain name.',
    })
  }
}
