import { OverrideStages } from '../constants'
import { IProjectDefaults } from '../index'

export const Config: IProjectDefaults = {
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
}

export default Config
