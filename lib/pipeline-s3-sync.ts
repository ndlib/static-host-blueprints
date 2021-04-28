import {
  BuildSpec,
  LinuxBuildImage,
  PipelineProject,
  PipelineProjectProps,
  BuildEnvironmentVariableType,
} from '@aws-cdk/aws-codebuild'
import { Artifact } from '@aws-cdk/aws-codepipeline'
import { CodeBuildAction } from '@aws-cdk/aws-codepipeline-actions'
import { PolicyStatement } from '@aws-cdk/aws-iam'
import { Construct, Fn, Duration } from '@aws-cdk/core'

export interface IPipelineS3SyncProps extends PipelineProjectProps {
  /**
   * The name of the stack that this project will deploy to. Will add
   * permissions to create change sets on these stacks.
   */
  readonly targetStack: string

  /**
   * Artifact that contains the build which needs to be synced to the s3 bucket.
   * Presumably the output from a previous codebuild project.
   */
  readonly inputBuildArtifact: Artifact

  /**
   * Subdirectory of files to sync. Optional; will sync everything by default.
   */
  readonly subdirectory?: string

  /**
   * Whether or not to invalidate the cloudfront cache after pushing files.
   */
  readonly invalidateCache?: boolean
}

export class PipelineS3Sync extends Construct {
  public readonly project: PipelineProject
  public readonly action: CodeBuildAction

  constructor(scope: Construct, id: string, props: IPipelineS3SyncProps) {
    super(scope, id)

    this.project = new PipelineProject(scope, `${props.targetStack}-S3Sync`, {
      description: 'Deploys built web components to bucket',
      timeout: Duration.minutes(10),
      environment: {
        buildImage: LinuxBuildImage.STANDARD_5_0,
        privileged: true,
      },
      environmentVariables: {
        // The stack that deploys these needs to export these parameters to the right path. This is necessary
        // since we can't know the distribution id until the pipeline has run to set up the cloudfront!
        DEST_BUCKET: {
          value: `/all/stacks/${props.targetStack}/site-bucket-name`,
          type: BuildEnvironmentVariableType.PARAMETER_STORE,
        },
        DISTRIBUTION_ID: {
          value: `/all/stacks/${props.targetStack}/distribution-id`,
          type: BuildEnvironmentVariableType.PARAMETER_STORE,
        },
      },
      buildSpec: BuildSpec.fromObject({
        phases: {
          pre_build: {
            commands: [
              // Remove existing files from the s3 bucket
              `aws s3 rm s3://$DEST_BUCKET --recursive`,
            ],
          },
          build: {
            commands: [
              // Copy new build to the site s3 bucket
              `cd ${props.subdirectory || '.'}`,
              `aws s3 cp --recursive . s3://$DEST_BUCKET/ --include "*" --exclude "*.shtml"`,
              `aws s3 cp --recursive . s3://$DEST_BUCKET/ --exclude "*" --include "*.shtml" --content-type "text/html"`,
            ],
          },
          post_build: {
            commands: (props.invalidateCache ?? true) ? [
              `aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/*"`,
            ] : [],
          },
        },
        version: '0.2',
      }),
    })

    // CDK will try to read logs when generating output for failed events
    this.project.addToRolePolicy(
      new PolicyStatement({
        actions: ['logs:DescribeLogGroups'],
        resources: ['*'],
      }),
    )

    // Add permissions to read CDK bootstrap stack/bucket
    this.project.addToRolePolicy(
      new PolicyStatement({
        actions: ['cloudformation:DescribeStacks'],
        resources: [Fn.sub('arn:aws:cloudformation:${AWS::Region}:${AWS::AccountId}:stack/CDKToolkit/*')],
      }),
    )
    this.project.addToRolePolicy(
      new PolicyStatement({
        actions: [
          's3:ListBucket',
          's3:GetObject',
          's3:PutObject',
          's3:ListBucketVersions',
          's3:GetBucketLocation',
          's3:GetBucketPolicy',
        ],
        resources: ['arn:aws:s3:::cdktoolkit-stagingbucket-*'],
      }),
    )
    this.project.addToRolePolicy(
      new PolicyStatement({
        actions: ['cloudfront:CreateInvalidation'],
        resources: ['*'],
      }),
    )
    // We don't know exactly what the bucket's name will be until runtime, but it starts with the stack's name
    this.project.addToRolePolicy(
      new PolicyStatement({
        actions: ['s3:*'],
        resources: [Fn.sub('arn:aws:s3:::' + props.targetStack + '*')],
      }),
    )
    this.project.addToRolePolicy(
      new PolicyStatement({
        actions: ['ssm:GetParametersByPath', 'ssm:GetParameter', 'ssm:GetParameters'],
        resources: [
          Fn.sub('arn:aws:ssm:${AWS::Region}:${AWS::AccountId}:parameter/all/stacks/' + props.targetStack + '/*'),
        ],
      }),
    )

    this.action = new CodeBuildAction({
      actionName: 'Sync_Build_Files_To_S3',
      input: props.inputBuildArtifact,
      project: this.project,
      runOrder: 2,
    })
  }
}
