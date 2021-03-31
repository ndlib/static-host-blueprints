import {
  BuildEnvironmentVariableType,
  BuildSpec,
  LinuxBuildImage,
  PipelineProject,
  PipelineProjectProps,
} from '@aws-cdk/aws-codebuild'
import { Role } from '@aws-cdk/aws-iam'
import * as cdk from '@aws-cdk/core'
import { IProjectDefaults } from './config'

export interface IStaticHostBuildProjectProps extends PipelineProjectProps {
  readonly stage: string
  readonly role: Role
  readonly outputDirectory?: string
  readonly projectName: string
  readonly projectEnv: IProjectDefaults

  readonly contextEnvName: string
  readonly contact: string
  readonly owner: string
}

export default class StaticHostBuildProject extends PipelineProject {
  constructor(scope: cdk.Construct, id: string, props: IStaticHostBuildProjectProps) {
    const projectProps = {
      environment: {
        buildImage: LinuxBuildImage.STANDARD_5_0,
        environmentVariables: {
          CI: {
            value: 'true',
            type: BuildEnvironmentVariableType.PLAINTEXT,
          },
          STACK_NAME: {
            value: `${props.projectEnv.stackNamePrefix}-${props.stage}`,
            type: BuildEnvironmentVariableType.PLAINTEXT,
          },
          STAGE: {
            value: props.stage,
            type: BuildEnvironmentVariableType.PLAINTEXT,
          },
          ...props.projectEnv.buildEnvironmentVariables,
        },
      },
      role: props.role,
      buildSpec: BuildSpec.fromObject({
        version: '0.2',
        artifacts: {
          'base-directory': props.outputDirectory || '/',
          files: ['**/*'],
        },
        phases: {
          install: {
            'runtime-versions': {
              nodejs: '14.x',
            },
            commands: (props.projectEnv.buildScripts || []).map((scriptPath) => {
              // Ensures each script file is executable
              return `chmod 755 "${scriptPath}"`
            }),
          },
          // Deploy infrastructure for hosting the site with static-host-stack
          pre_build: {
            commands: [
              'cd "$CODEBUILD_SRC_DIR_InfraCode"',
              'chmod 755 ./setup.sh && ./setup.sh',
              `npm run -- cdk deploy "$STACK_NAME" \
                -c stage="$STAGE" \
                -c env="${props.contextEnvName}" \
                -c project="${props.projectName}" \
                -c contact="${props.contact}" \
                -c owner="${props.owner}" \
                -c stackType=service \
                --require-approval=never
              `,
            ],
          },
          // Now build the actual application (if applicable)
          build: {
            commands: props.projectEnv.buildScripts,
          },
        },
      }),
    }
    super(scope, id, projectProps)
  }
}
