import { IProjectDefaults } from '../index'

export const Config: IProjectDefaults = {
  stackNamePrefix: 'gis-day',
  appRepoOwner: 'ndlib',
  appRepoName: 'website-events-gisday',
  appSourceBranch: 'master',
  createWebhook: true,
  createSpaRedirects: false,
  supportHtmlIncludes: true,
  buildOutputDir: 'gisday',
  indexFilename: 'index.shtml',
}

export default Config
