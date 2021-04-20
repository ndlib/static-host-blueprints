import { PipelineProject, BuildSpec, BuildEnvironmentVariableType, LinuxBuildImage } from '@aws-cdk/aws-codebuild'
import { Role } from '@aws-cdk/aws-iam'
import { Construct } from '@aws-cdk/core'

export interface IStaticHostQaProjectProps {
  readonly smokeTestsCollection: string
  readonly hostname: string
  readonly role?: Role
}

export class StaticHostQaProject extends PipelineProject {
  constructor(scope: Construct, id: string, props: IStaticHostQaProjectProps) {
    const pipelineProps = {
      role: props.role,
      environment: {
        buildImage: LinuxBuildImage.STANDARD_5_0,
        environmentVariables: {
          CI: { value: 'true', type: BuildEnvironmentVariableType.PLAINTEXT },
        },
      },
      buildSpec: BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            'runtime-versions': {
              nodejs: '14.x',
            },
            commands: [
              'npm install -g newman@5.2.2',
              'echo "Ensure that the Newman spec is readable"',
              `chmod 755 ${props.smokeTestsCollection}`,
            ],
          },
          build: {
            commands: [`newman run ${props.smokeTestsCollection} --env-var hostname=${props.hostname}`],
          },
        },
      }),
    }
    super(scope, id, pipelineProps)
  }
}

export default StaticHostQaProject
