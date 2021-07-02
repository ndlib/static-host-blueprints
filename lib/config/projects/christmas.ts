import { IProjectDefaults } from '../index'

export const Config: IProjectDefaults = {
  stackNamePrefix: 'christmas',
  appRepoOwner: 'ndlib',
  appRepoName: 'website-events-christmas',
  appSourceBranch: 'master',
  createWebhook: true,
  createSpaRedirects: false,
  supportHtmlIncludes: false,
  buildOutputDir: 'christmas',
  indexFilename: '2020/index.html',
}

export default Config
