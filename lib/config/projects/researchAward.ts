import { Duration } from '@aws-cdk/core'
import { IProjectDefaults } from '../index'

export const Config: IProjectDefaults = {
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
}

export default Config
