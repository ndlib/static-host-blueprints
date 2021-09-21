import { IProjectDefaults } from '../index'
import { PolicyStatement } from '@aws-cdk/aws-iam'
import { Fn } from '@aws-cdk/core'

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
  deploymentPolicies: [
    new PolicyStatement({
      resources: [
        Fn.sub('arn:aws:secretsmanager:${AWS::Region}:${AWS::AccountId}:secret:/all/contentful/*'),
      ],
      actions: [
        'secretsmanager:DescribeSecret',
        'secretsmanager:GetSecretValue',
        'secretsmanager:ListSecretVersionIds',
      ],
    }),
  ],
}

export default Config
