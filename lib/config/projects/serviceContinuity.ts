import { Duration } from '@aws-cdk/core'
import { IProjectDefaults } from '../index'

export const Config: IProjectDefaults = {
  stackNamePrefix: 'service-continuity',
  appRepoOwner: 'ndlib',
  appRepoName: 'website-service-continuity',
  appSourceBranch: 'master',
  createWebhook: true,
  createSpaRedirects: false,
  supportHtmlIncludes: false,
  cacheTtl: Duration.hours(1),
}

export default Config
