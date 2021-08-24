import { Duration } from '@aws-cdk/core'
import { IProjectDefaults } from '../index'

export const Config: IProjectDefaults = {
  stackNamePrefix: 'seasidetwo',
  hostnamePrefix: 'seasidetwo',
  appRepoOwner: 'ndlib',
  appRepoName: 'seaside',
  appSourceBranch: 'deployment',
  createWebhook: true,
  createSpaRedirects: false,
  supportHtmlIncludes: false,
  buildOutputDir: 'public',
  cacheTtl: Duration.hours(1),
}

export default Config