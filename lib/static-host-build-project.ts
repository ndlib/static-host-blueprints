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
import { IContextEnv } from './context-env'

export interface IStaticHostBuildProjectProps extends PipelineProjectProps {
  readonly stage: string
  readonly role: Role
  readonly outputDirectory?: string
  readonly projectName: string
  readonly projectEnv: IProjectDefaults

  readonly contextEnv: IContextEnv
  readonly contact: string
  readonly owner: string
}

export default class StaticHostBuildProject extends PipelineProject {
  constructor(scope: cdk.Construct, id: string, props: IStaticHostBuildProjectProps) {
    const additionalContext: string[] = []

    // These are the keys from the project env that we will pass on as additional context values.
    // This is needed in case they were overridden when the pipeline was deployed instead of changing the config.
    const projectContextKeys: Array<keyof IProjectDefaults> = [
      'stackNamePrefix',
      'hostnamePrefix',
      'createSpaRedirects',
      'supportHtmlIncludes',
      'indexFilename',
      'cacheTtl',
      'domainOverride',
    ]

    projectContextKeys.forEach(key => {
      // You can use empty string to deliberately override the default context value with nothing
      // Objects are NOT supported with cli context so those will be omitted
      if ((!props.projectEnv[key] && props.projectEnv[key] !== '') || typeof props.projectEnv[key] === 'object') {
        return
      }
      additionalContext.push(`-c ${props.projectName}:${key}="${props.projectEnv[key]}"`)
    })

    // If environment context values were overridden when deploying pipeline, we need to pass them through to the build
    const environmentContextKeys: Array<keyof IContextEnv> = [
      'createDns',
      'domainStackName',
    ]
    environmentContextKeys.forEach(key => {
      // You can use empty string to deliberately override the default context value with nothing
      // Objects are NOT supported with cli context so those will be omitted
      if ((!props.contextEnv[key] && props.contextEnv[key] !== '') || typeof props.contextEnv[key] === 'object') {
        return
      }
      additionalContext.push(`-c environments:${props.contextEnv.name}:${key}="${props.contextEnv[key]}"`)
    })

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
          'base-directory': props.outputDirectory || './',
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
                -c env="${props.contextEnv.name}" \
                -c project="${props.projectName}" \
                -c contact="${props.contact}" \
                -c owner="${props.owner}" \
                -c stackType=service \
                ${additionalContext.join(' ')} \
                --require-approval=never
              `,
              'cd -',
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
