import { IProjectDefaults } from '../index'

export const Config: IProjectDefaults = {
  stackNamePrefix: 'archives-retention',
  appRepoOwner: 'ndlib',
  appRepoName: 'archives-rr',
  appSourceBranch: 'master',
  createWebhook: true,
  createSpaRedirects: true,
  supportHtmlIncludes: false,
  buildOutputDir: 'build',
  buildScripts: [
    'scripts/codebuild/install.sh',
    'scripts/codebuild/pre_build.sh',
    'scripts/codebuild/build.sh',
    'scripts/codebuild/post_build.sh',
  ],
}

export default Config
