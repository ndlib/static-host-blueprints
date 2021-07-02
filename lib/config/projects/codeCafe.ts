import { IProjectDefaults } from '../index'

export const Config: IProjectDefaults = {
  stackNamePrefix: 'code-cafe',
  appRepoOwner: 'ndlib',
  appRepoName: 'website-events-code-cafe',
  appSourceBranch: 'master',
  createWebhook: true,
  createSpaRedirects: false,
  supportHtmlIncludes: false,
  buildOutputDir: 'code-cafe',
}

export default Config
