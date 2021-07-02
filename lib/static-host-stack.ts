import {
  CfnDistribution,
} from '@aws-cdk/aws-cloudfront'
import * as cdk from '@aws-cdk/core'
import { TransclusionLambda, SpaRedirectionLambda, StaticHost, IEdgeLambda } from '@ndlib/ndlib-cdk'
import { CertificateHelper } from './certificate-helper'
import { OverrideStages } from './config/constants'

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

    const cacheTtl = props.contextEnvName === 'dev' ? cdk.Duration.seconds(0) : props.cacheTtl || cdk.Duration.days(1)

    // Create edge lambdas (if needed)
    const edgeLambdas: IEdgeLambda[] = []
    if (props.createSpaRedirects) {
      const spaRedirectionLambda = new SpaRedirectionLambda(this, 'SPARedirectionLambda', {
        isDefaultBehavior: true,
        defaultTtl: cacheTtl,
      })
      edgeLambdas.push(spaRedirectionLambda)
    }

    let transclusionLambda: TransclusionLambda | null = null
    if (props.supportHtmlIncludes) {
      transclusionLambda = new TransclusionLambda(this, 'TransclusionLambda', {
        // only make it default if we don't already have a default behavior
        isDefaultBehavior: !edgeLambdas.some(lambda => lambda.behavior.isDefaultBehavior),
        defaultTtl: cacheTtl,
      })
      edgeLambdas.push(transclusionLambda)
    }

    // Won't work right if it starts with slash. It's an easy mistake to make so just handle it here
    let indexPath = props.indexFilename || 'index.html'
    if (indexPath.startsWith('/')) {
      indexPath = indexPath.substring(1)
    }

    // This is the main construct that puts everything together! Include buckets, CloudFront, DNS, etc.
    const staticHost = new StaticHost(this, 'StaticHost', {
      hostnamePrefix: prefix,
      domainName: certHelper.domainName,
      websiteCertificate: certHelper.websiteCertificate,
      createDns: props.createDns,
      hostedZoneId: cdk.Fn.importValue(`${props.domainStackName}:Zone`),
      indexFilename: indexPath,
      edgeLambdas: edgeLambdas,
      errorConfig: props.errorConfig,
    })
    if (transclusionLambda) {
      transclusionLambda.grantBucketAccess(staticHost.bucket)
    }
  }
}
