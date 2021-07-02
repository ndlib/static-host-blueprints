import * as cdk from '@aws-cdk/core'
import { SourceWatcher, IPipelineTrigger } from '@ndlib/ndlib-cdk'
import Config from './config'

export interface ISourceWatcherStackProps extends cdk.StackProps {
  readonly webhookResourceStackName: string
  readonly infraRepoOwner: string
  readonly infraRepoName: string
  readonly infraSourceBranch: string
  readonly gitTokenPath: string
}

export class SourceWatcherStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: ISourceWatcherStackProps) {
    super(scope, id, props)

    const triggers: IPipelineTrigger[] = Object.keys(Config).map(projectKey => {
      return {
        triggerPatterns: [
          // If the individual project config file is modified
          `lib/config/projects/${projectKey}.ts`,

          // If anything in the lib or bin folders (exluding subdirectories) is modified, all pipelines will trigger
          'lib/*',
          'bin/**/*',

          // Likewise, any file changes at the root excluding certain "safe to edit" files
          '*',
          '!+(README.md|LICENSE)',
        ],
        pipelineStackName: `${Config[projectKey].stackNamePrefix}-pipeline`,
      }
    })

    new SourceWatcher(this, 'SourceWatcher', {
      triggers,
      gitTokenPath: props.gitTokenPath,
      targetRepo: `${props.infraRepoOwner}/${props.infraRepoName}`,
      targetBranch: props.infraSourceBranch,
      webhookResourceStackName: props.webhookResourceStackName,
    })
  }
}
