import { CfnDistribution } from '@aws-cdk/aws-cloudfront'

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
  readonly createSpaRedirects: boolean
  readonly buildScripts?: string[]
  readonly buildOutputDir?: string
  readonly errorConfig?: CfnDistribution.CustomErrorResponseProperty[]
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
    createSpaRedirects: false,
    buildOutputDir: 'hackathon',
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
    createSpaRedirects: false,
    buildOutputDir: 'gisday',
  },
  christmas: {
    stackNamePrefix: 'christmas',
    appRepoOwner: 'ndlib',
    appRepoName: 'website-events-christmas',
    appSourceBranch: 'master',
    createSpaRedirects: false,
    buildOutputDir: 'christmas',
  },
}

export default Config
