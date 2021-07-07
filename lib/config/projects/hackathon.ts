import { IProjectDefaults } from '../index'

export const Config: IProjectDefaults = {
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
}

export default Config
