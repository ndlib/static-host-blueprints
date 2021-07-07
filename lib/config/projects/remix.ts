import { OverrideStages } from '../constants'
import { IProjectDefaults } from '../index'

export const Config: IProjectDefaults = {
  stackNamePrefix: 'remix',
  domainOverride: {
    domainName: 'nd.edu',
    certificateArnParam: '/all/remix/certificatearn',
    stages: OverrideStages.PROD,
  },
  appRepoOwner: 'ndlib',
  appRepoName: 'remix',
  appSourceBranch: 'master',
  createWebhook: true,
  createSpaRedirects: false,
  supportHtmlIncludes: false
}

export default Config
