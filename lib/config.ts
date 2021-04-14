import { CfnDistribution } from '@aws-cdk/aws-cloudfront'
import { PolicyStatement } from '@aws-cdk/aws-iam'
import { BuildEnvironmentVariable } from '@aws-cdk/aws-codebuild'
import { Duration } from '@aws-cdk/core'

export enum OverrideStages {
  TEST,
  PROD,
  ALL,
}

export interface IProjectDefaults {
  readonly stackNamePrefix: string
  readonly hostnamePrefix?: string
  readonly domainOverride?: {
    readonly domainName: string
    readonly certificateArnParam: string
    readonly stages: OverrideStages
  }
  readonly appRepoOwner: string
  readonly appRepoName: string
  readonly appSourceBranch: string
  readonly createWebhook: boolean
  readonly createSpaRedirects: boolean
  readonly supportHtmlIncludes: boolean
  readonly buildScripts?: string[]
  readonly buildOutputDir?: string
  readonly smokeTestsCollection?: string
  readonly indexFilename?: string
  readonly cacheTtl?: Duration
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
    supportHtmlIncludes: true,
    buildOutputDir: 'hackathon',
    indexFilename: 'index.shtml',
    errorConfig: [
      {
        errorCode: 400,
        responseCode: 400,
        responsePagePath: '/error/400.shtml',
        errorCachingMinTtl: 300,
      },
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
      {
        errorCode: 405,
        responseCode: 405,
        responsePagePath: '/error/405.shtml',
        errorCachingMinTtl: 300,
      },
      {
        errorCode: 500,
        responseCode: 500,
        responsePagePath: '/error/500.shtml',
        errorCachingMinTtl: 300,
      },
      {
        errorCode: 501,
        responseCode: 501,
        responsePagePath: '/error/501.shtml',
        errorCachingMinTtl: 300,
      },
      {
        errorCode: 503,
        responseCode: 503,
        responsePagePath: '/error/503.shtml',
        errorCachingMinTtl: 300,
      },
      {
        errorCode: 504,
        responseCode: 504,
        responsePagePath: '/error/504.shtml',
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
    supportHtmlIncludes: true,
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
    supportHtmlIncludes: false,
    buildOutputDir: 'christmas',
    indexFilename: '2020/index.html',
  },
  serviceContinuity: {
    stackNamePrefix: 'service-continuity',
    appRepoOwner: 'ndlib',
    appRepoName: 'website-service-continuity',
    appSourceBranch: 'master',
    createWebhook: true,
    createSpaRedirects: false,
    supportHtmlIncludes: false,
    cacheTtl: Duration.hours(1),
  },
  researchAward: {
    stackNamePrefix: 'research-award',
    hostnamePrefix: 'library-research-award',
    appRepoOwner: 'ndlib',
    appRepoName: 'library-research-award',
    appSourceBranch: 'master',
    createWebhook: true,
    createSpaRedirects: false,
    supportHtmlIncludes: false,
    buildOutputDir: 'src',
    cacheTtl: Duration.hours(1),
    // TODO: Implement selenium smoke tests
  },
  fatherTed: {
    stackNamePrefix: 'father-ted-archive',
    hostnamePrefix: 'hesburghportal',
    domainOverride: {
      domainName: 'nd.edu',
      certificateArnParam: '/all/hesburghportal/certificatearn',
      stages: OverrideStages.PROD,
    },
    appRepoOwner: 'ndlib',
    appRepoName: 'father-ted-archive',
    appSourceBranch: 'master',
    createWebhook: true,
    createSpaRedirects: false,
    supportHtmlIncludes: false,
    smokeTestsCollection: 'tests/postman/qa_collection.json'
  },
}

export default Config
