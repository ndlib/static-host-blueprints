import { Duration } from '@aws-cdk/core'
import { BuildEnvironmentVariableType } from '@aws-cdk/aws-codebuild'
import { IProjectDefaults } from '../index'

export const Config: IProjectDefaults = {
  stackNamePrefix: 'seasidetwo',
  hostnamePrefix: 'seasidetwo',
  appRepoOwner: 'ndlib',
  appRepoName: 'seaside',
  appSourceBranch: 'deployment',
  createWebhook: true,
  createSpaRedirects: true,
  supportHtmlIncludes: false,
  buildOutputDir: 'public',
  buildScripts: ['scripts/codebuild/codebuild.sh'],
  cacheTtl: Duration.hours(1),
  buildEnvironmentVariables: {
    SEASIDE_ELASTICSEARCH: {
      type: BuildEnvironmentVariableType.PARAMETER_STORE, value: '/all/seaside/elasticsearch',
    },
  },
}

export default Config