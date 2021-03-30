import path = require('path')
import {
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
import { Function, Code, Runtime } from '@aws-cdk/aws-lambda'
import { CnameRecord, HostedZone } from '@aws-cdk/aws-route53'
import { Bucket, BucketAccessControl } from '@aws-cdk/aws-s3'
import { StringParameter } from '@aws-cdk/aws-ssm'
import * as cdk from '@aws-cdk/core'
import { Certificate, ICertificate } from '@aws-cdk/aws-certificatemanager'

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
  }

  /**
   * Name of the repo which contains the site to deploy. (Only used when deploying locally/not from a pipeline.)
   */
  readonly appRepoName?: string

  /**
   * Output directory where build will be. Or in the case of a static site, the folder to upload and make public.
   */
  readonly buildOutputDir?: string

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
  public readonly spaRedirectionLambda?: Function

  constructor(scope: cdk.Construct, id: string, props: IStaticHostStackProps) {
    super(scope, id, props)

    if (props.createSpaRedirects) {
      const lambdaCodePath = path.join(__dirname, '../src/spaRedirectionLambda')
      this.spaRedirectionLambda = new Function(this, 'SPARedirectionLambda', {
        code: Code.fromAsset(lambdaCodePath),
        description: 'Basic rewrite rule to send directory requests to appropriate locations in the SPA.',
        handler: 'handler.handler',
        runtime: Runtime.NODEJS_14_X,
      })
    }

    let domainName: string
    let websiteCertificate: ICertificate
    if (props.domainOverride) {
      const certificateArn = StringParameter.valueForStringParameter(this, props.domainOverride.certificateArnParam)
      websiteCertificate = Certificate.fromCertificateArn(this, 'WebsiteCertificate', certificateArn)
      domainName = props.domainOverride.domainName
    } else {
      const certificateArn = cdk.Fn.importValue(`${props.domainStackName}:ACMCertificateARN`)
      websiteCertificate = Certificate.fromCertificateArn(this, 'WebsiteCertificate', certificateArn)
      domainName = cdk.Fn.importValue(`${props.domainStackName}:DomainName`)
    }

    // Use stack name if no hostname prefix is provided
    let prefix = props.hostnamePrefix || this.stackName
    if (props.hostnamePrefix && props.stage !== 'prod') {
      // For non-prod stacks, add the stage to the end of the name.
      prefix += `-${props.stage}`
    }
    this.hostname = `${prefix}.${domainName}`

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
      serverAccessLogsPrefix: `s3/${this.hostname}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    this.cloudfront = new CloudFrontWebDistribution(this, 'Distribution', {
      comment: this.hostname,
      errorConfigurations: props.errorConfig,
      loggingConfig: {
        bucket: this.logBucket,
        includeCookies: true,
        prefix: `web/${this.hostname}`,
      },
      originConfigs: [
        {
          s3OriginSource: {
            s3BucketSource: this.bucket,
            originAccessIdentity: new OriginAccessIdentity(this, 'OriginAccessIdentity', {
              comment: `Static assets in ${this.stackName}`,
            }),
          },
          behaviors: [
            {
              allowedMethods: CloudFrontAllowedMethods.GET_HEAD_OPTIONS,
              compress: true,
              defaultTtl: props.contextEnvName === 'dev' ? cdk.Duration.seconds(0) : cdk.Duration.days(1),
              isDefaultBehavior: true,
              lambdaFunctionAssociations: this.spaRedirectionLambda
                ? [
                    {
                      eventType: LambdaEdgeEventType.ORIGIN_REQUEST,
                      lambdaFunction: this.spaRedirectionLambda.currentVersion,
                    },
                  ]
                : [],
            },
          ],
        },
      ],
      viewerCertificate: ViewerCertificate.fromAcmCertificate(websiteCertificate, {
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
          zoneName: domainName,
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
