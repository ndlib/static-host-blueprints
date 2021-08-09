import { PolicyStatement, Role, RoleProps } from '@aws-cdk/aws-iam'
import { Bucket } from '@aws-cdk/aws-s3'
import * as cdk from '@aws-cdk/core'

export interface IStaticHostBuildRoleProps extends RoleProps {
  readonly stackNamePrefix: string
  readonly hostnamePrefix?: string
  readonly stages: string[]
  readonly artifactBucket: Bucket
  readonly createDns: boolean
  readonly domainStackName?: string
  readonly certificateArnParam?: string
  readonly additionalPolicies?: PolicyStatement[]
}

export class StaticHostBuildRole extends Role {
  constructor(scope: cdk.Construct, id: string, props: IStaticHostBuildRoleProps) {
    super(scope, id, props)

    const serviceStacks = props.stages.map((stage) => `${props.stackNamePrefix}-${stage}`)

    // Allow checking what policies are attached to this role
    this.addToPolicy(
      new PolicyStatement({
        resources: [this.roleArn],
        actions: ['iam:GetRolePolicy'],
      }),
    )
    // Allow modifying IAM roles related to our application
    this.addToPolicy(
      new PolicyStatement({
        resources: serviceStacks.map((stackName) =>
          cdk.Fn.sub('arn:aws:iam::${AWS::AccountId}:role/' + stackName + '*'),
        ),
        actions: [
          'iam:GetRole',
          'iam:GetRolePolicy',
          'iam:CreateRole',
          'iam:DeleteRole',
          'iam:DeleteRolePolicy',
          'iam:AttachRolePolicy',
          'iam:DetachRolePolicy',
          'iam:PutRolePolicy',
          'iam:PassRole',
          'iam:TagRole',
        ],
      }),
    )

    // Global resource permissions for managing cloudfront and logs
    this.addToPolicy(
      new PolicyStatement({
        resources: ['*'],
        actions: [
          'cloudformation:ListExports',
          'cloudfront:GetDistribution',
          'cloudfront:CreateDistribution',
          'cloudfront:UpdateDistribution',
          'cloudfront:TagResource',
          'cloudfront:CreateInvalidation',
          'cloudfront:CreateCloudFrontOriginAccessIdentity',
          'cloudfront:GetCloudFrontOriginAccessIdentity',
          'cloudfront:DeleteCloudFrontOriginAccessIdentity',
          'cloudfront:ListCloudFrontOriginAccessIdentities',
          'logs:CreateLogGroup',
        ],
      }),
    )

    // Allow logging for this stack
    this.addToPolicy(
      new PolicyStatement({
        resources: [
          cdk.Fn.sub('arn:aws:logs:${AWS::Region}:${AWS::AccountId}:log-group:/aws/codebuild/${AWS::StackName}-*'),
        ],
        actions: ['logs:CreateLogStream'],
      }),
    )
    this.addToPolicy(
      new PolicyStatement({
        resources: [
          cdk.Fn.sub(
            'arn:aws:logs:${AWS::Region}:${AWS::AccountId}:log-group:/aws/codebuild/${AWS::StackName}-*:log-stream:*',
          ),
        ],
        actions: ['logs:PutLogEvents'],
      }),
    )

    // Allow storing artifacts in S3 buckets
    this.addToPolicy(
      new PolicyStatement({
        resources: [props.artifactBucket.bucketArn, 'arn:aws:s3:::cdktoolkit-stagingbucket-*'],
        actions: ['s3:ListBucket', 's3:ListBucketVersions', 's3:GetBucketLocation', 's3:GetBucketPolicy'],
      }),
    )
    this.addToPolicy(
      new PolicyStatement({
        resources: [props.artifactBucket.bucketArn + '/*', 'arn:aws:s3:::cdktoolkit-stagingbucket-*/*'],
        actions: ['s3:GetObject', 's3:PutObject'],
      }),
    )
    // Allow creating and managing s3 bucket for site
    const prefix = (props.hostnamePrefix || props.stackNamePrefix).substring(0, 25)
    this.addToPolicy(
      new PolicyStatement({
        resources: [cdk.Fn.sub('arn:aws:s3:${AWS::Region}:${AWS::AccountId}:' + prefix + '*')],
        actions: [
          's3:CreateBucket',
          's3:ListBucket*',
          's3:GetBucket*',
          's3:DeleteBucket*',
          's3:PutBucket*',
          's3:PutLifecycleConfiguration',
        ],
      }),
    )
    this.addToPolicy(
      new PolicyStatement({
        resources: serviceStacks.map((stackName) => cdk.Fn.sub('arn:aws:s3:::' + stackName + '*/*')),
        actions: ['s3:GetObject*', 's3:DeleteObject*', 's3:PutObject*', 's3:Abort*', 's3:ReplicateTags'],
      }),
    )

    // Allow creating and managing lambda with this stack name
    this.addToPolicy(
      new PolicyStatement({
        resources: serviceStacks.map((stackName) =>
          cdk.Fn.sub('arn:aws:lambda:${AWS::Region}:${AWS::AccountId}:function:' + stackName + '*'),
        ),
        actions: ['lambda:*'],
      }),
    )

    // Allow fetching details about and updating the application stack
    this.addToPolicy(
      new PolicyStatement({
        resources: serviceStacks.map((stackName) =>
          cdk.Fn.sub('arn:aws:cloudformation:${AWS::Region}:${AWS::AccountId}:stack/' + stackName + '/*'),
        ),
        actions: [
          'cloudformation:DescribeStacks',
          'cloudformation:DescribeStackEvents',
          'cloudformation:DescribeChangeSet',
          'cloudformation:CreateChangeSet',
          'cloudformation:ExecuteChangeSet',
          'cloudformation:DeleteChangeSet',
          'cloudformation:DeleteStack',
          'cloudformation:GetTemplate',
        ],
      }),
    )

    // Allow reading some details about CDKToolkit stack so we can use the CDK CLI successfully from CodeBuild.
    this.addToPolicy(
      new PolicyStatement({
        resources: [cdk.Fn.sub('arn:aws:cloudformation:${AWS::Region}:${AWS::AccountId}:stack/CDKToolkit/*')],
        actions: ['cloudformation:DescribeStacks'],
      }),
    )

    // Allow creating DNS records in the domain stack's zone
    if (props.createDns) {
      this.addToPolicy(
        new PolicyStatement({
          resources: [
            cdk.Fn.sub('arn:aws:route53:::hostedzone/${importedZone}', {
              importedZone: cdk.Fn.importValue(`${props.domainStackName}:Zone`),
            }),
            'arn:aws:route53:::change/*',
          ],
          actions: ['route53:GetHostedZone', 'route53:ChangeResourceRecordSets', 'route53:GetChange'],
        }),
      )
    }

    // Allow fetching parameters from ssm
    this.addToPolicy(
      new PolicyStatement({
        resources: [
          cdk.Fn.sub('arn:aws:ssm:${AWS::Region}:${AWS::AccountId}:parameter/all/' + props.stackNamePrefix + '/*'),
          cdk.Fn.sub('arn:aws:ssm:${AWS::Region}:${AWS::AccountId}:parameter/all/github/*'),
        ],
        actions: ['ssm:GetParametersByPath', 'ssm:GetParameter', 'ssm:GetParameters'],
      }),
    )
    if (props.certificateArnParam) {
      this.addToPolicy(
        new PolicyStatement({
          resources: [cdk.Fn.sub('arn:aws:ssm:${AWS::Region}:${AWS::AccountId}:parameter' + props.certificateArnParam)],
          actions: ['ssm:GetParametersByPath', 'ssm:GetParameter', 'ssm:GetParameters'],
        }),
      )
    }

    // Allow getting needed secrets from SecretsManager
    this.addToPolicy(
      new PolicyStatement({
        resources: [
          cdk.Fn.sub(
            'arn:aws:secretsmanager:${AWS::Region}:${AWS::AccountId}:secret:/all/' + props.stackNamePrefix + '-*',
          ),
        ],
        actions: [
          'secretsmanager:GetSecretValue',
          'secretsmanager:DescribeSecret',
          'secretsmanager:ListSecretVersionIds',
        ],
      }),
    )

    // Allow creating parameters (and delete in case of stack rollback)
    this.addToPolicy(
      new PolicyStatement({
        resources: [
          cdk.Fn.sub('arn:aws:ssm:${AWS::Region}:${AWS::AccountId}:parameter/all/' + props.stackNamePrefix + '/*'),
          ...serviceStacks.map((stackName) =>
            cdk.Fn.sub('arn:aws:ssm:${AWS::Region}:${AWS::AccountId}:parameter/all/stacks/' + stackName + '/*'),
          ),
        ],
        actions: ['ssm:PutParameter', 'ssm:DeleteParameter', 'ssm:AddTagsToResource', 'ssm:RemoveTagsFromResource'],
      }),
    )

    // These are policies specific to the particular project being deployed
    if (props.additionalPolicies) {
      props.additionalPolicies.forEach((statement) => {
        this.addToPolicy(statement)
      })
    }
  }
}

export default StaticHostBuildRole
