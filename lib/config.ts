import { CfnDistribution } from '@aws-cdk/aws-cloudfront'
import { PolicyStatement } from '@aws-cdk/aws-iam'
import { BuildEnvironmentVariable, BuildEnvironmentVariableType } from '@aws-cdk/aws-codebuild'

export interface IProjectDefaults {
  readonly stackNamePrefix: string
  readonly hostnamePrefix?: string
  readonly domainOverride?: {
    readonly domainName: string
    readonly certificateArnParam: string
  }
  readonly appRepoOwner: string
  readonly appRepoName: string
  readonly appSourceBranch: string
  readonly createWebhook: boolean
  readonly createSpaRedirects: boolean
  readonly buildScripts?: string[]
  readonly buildOutputDir?: string
  readonly smokeTestsCollection?: string
  readonly indexFilename?: string
  readonly errorConfig?: CfnDistribution.CustomErrorResponseProperty[]
  readonly deploymentPolicies?: PolicyStatement[]
  readonly buildEnvironmentVariables?: {
    [key: string]: BuildEnvironmentVariable
  }
}

export interface IConfig {
  readonly [key: string]: IProjectDefaults
}

// Project-specific default values should be set here. They can still be overridden with context,
// but it's easier to manage here with type-checking goodness.
export const Config: IConfig = {
  hackathon: {
    stackNamePrefix: 'hackathon',
    appRepoOwner: 'ndlib',
    appRepoName: 'website-events-hackathon',
    appSourceBranch: 'master',
    createWebhook: true,
    createSpaRedirects: false,
    buildOutputDir: 'hackathon',
    indexFilename: 'index.shtml',
    errorConfig: [
      {
        errorCode: 403,
        responseCode: 403,
        responsePagePath: '/error/403.shtml',
        errorCachingMinTtl: 300,
      },
      {
        errorCode: 404,
        responseCode: 404,
        responsePagePath: '/error/404.shtml',
        errorCachingMinTtl: 300,
      },
    ],
  },
  gisday: {
    stackNamePrefix: 'gis-day',
    hostnamePrefix: 'gisday',
    appRepoOwner: 'ndlib',
    appRepoName: 'website-events-gisday',
    appSourceBranch: 'master',
    createWebhook: true,
    createSpaRedirects: false,
    buildOutputDir: 'gisday',
    indexFilename: 'index.shtml',
  },
  christmas: {
    stackNamePrefix: 'christmas',
    appRepoOwner: 'ndlib',
    appRepoName: 'website-events-christmas',
    appSourceBranch: 'master',
    createWebhook: true,
    createSpaRedirects: false,
    buildOutputDir: 'christmas',
    indexFilename: '2020/index.html',
  },
}

export default Config
