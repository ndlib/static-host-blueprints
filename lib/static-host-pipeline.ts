import codepipeline = require('@aws-cdk/aws-codepipeline')
import {
  CodeBuildAction,
  GitHubSourceAction,
  GitHubTrigger,
  ManualApprovalAction,
} from '@aws-cdk/aws-codepipeline-actions'
import { Role, ServicePrincipal } from '@aws-cdk/aws-iam'
import * as sns from '@aws-cdk/aws-sns'
import * as cdk from '@aws-cdk/core'
import { ArtifactBucket, PipelineNotifications, SlackApproval, NewmanRunner } from '@ndlib/ndlib-cdk'
import { CertificateHelper } from './certificate-helper'
import { IProjectDefaults } from './config'
import StaticHostBuildProject from './static-host-build-project'
import StaticHostBuildRole from './static-host-build-role'
import { PipelineS3Sync } from './pipeline-s3-sync'

const stages = ['test', 'prod']

export interface IStaticHostPipelineStackProps extends cdk.StackProps {
  readonly projectEnv: IProjectDefaults

  readonly projectName: string
  readonly contextEnvName: string
  readonly contact: string
  readonly owner: string
  readonly gitTokenPath: string
  readonly infraRepoOwner: string
  readonly infraRepoName: string
  readonly infraSourceBranch: string
  readonly smokeTestsPath: string
  readonly createDns: boolean
  readonly domainStackName?: string
  readonly slackNotifyStackName?: string
  readonly notificationReceivers?: string
}

export class StaticHostPipelineStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props: IStaticHostPipelineStackProps) {
    super(scope, id, props)

    // Find the domain name and certificate to use
    const testCertHelper = new CertificateHelper(this, 'TestCertHelper', {
      stage: 'test',
      domainStackName: props.domainStackName,
      domainOverride: props.projectEnv.domainOverride,
    })
    const prodCertHelper = new CertificateHelper(this, 'ProdCertHelper', {
      stage: 'prod',
      domainStackName: props.domainStackName,
      domainOverride: props.projectEnv.domainOverride,
    })

    const prefix = props.projectEnv.hostnamePrefix || props.projectEnv.stackNamePrefix
    const testHost = `${prefix}-test.${testCertHelper.domainName}`
    const prodHost = `${prefix}.${prodCertHelper.domainName}`

    // S3 BUCKET FOR STORING ARTIFACTS
    const artifactBucket = new ArtifactBucket(this, 'ArtifactBucket', {})

    // IAM ROLES
    const codepipelineRole = new Role(this, 'CodePipelineRole', {
      assumedBy: new ServicePrincipal('codepipeline.amazonaws.com'),
    })
    const codebuildRole = new StaticHostBuildRole(this, 'CodeBuildTrustRole', {
      assumedBy: new ServicePrincipal('codebuild.amazonaws.com'),
      stackNamePrefix: props.projectEnv.stackNamePrefix,
      stages,
      artifactBucket,
      createDns: props.createDns,
      domainStackName: props.domainStackName,
      certificateArnParam: props.projectEnv.domainOverride?.certificateArnParam,
      additionalPolicies: props.projectEnv.deploymentPolicies,
    })

    // CREATE PIPELINE
    const pipeline = new codepipeline.Pipeline(this, 'CodePipeline', {
      artifactBucket,
      role: codepipelineRole,
    })
    if (props.notificationReceivers) {
      new PipelineNotifications(this, 'PipelineNotifications', {
        pipeline,
        receivers: props.notificationReceivers,
      })
    }

    // SOURCE CODE AND BLUEPRINTS
    const appSourceArtifact = new codepipeline.Artifact('AppCode')
    const appSourceAction = new GitHubSourceAction({
      actionName: 'SourceAppCode',
      owner: props.projectEnv.appRepoOwner,
      repo: props.projectEnv.appRepoName,
      branch: props.projectEnv.appSourceBranch,
      oauthToken: cdk.SecretValue.secretsManager(props.gitTokenPath, { jsonField: 'oauth' }),
      output: appSourceArtifact,
      trigger: props.projectEnv.createWebhook ? GitHubTrigger.WEBHOOK : GitHubTrigger.POLL,
    })
    const infraSourceArtifact = new codepipeline.Artifact('InfraCode')
    const infraSourceAction = new GitHubSourceAction({
      actionName: 'SourceInfraCode',
      owner: props.infraRepoOwner,
      repo: props.infraRepoName,
      branch: props.infraSourceBranch,
      oauthToken: cdk.SecretValue.secretsManager(props.gitTokenPath, { jsonField: 'oauth' }),
      output: infraSourceArtifact,
      trigger: GitHubTrigger.NONE,
    })
    pipeline.addStage({
      stageName: 'Source',
      actions: [appSourceAction, infraSourceAction],
    })

    // DEPLOY TO TEST
    const testBuildOutput = new codepipeline.Artifact('TestBuild')
    const deployToTestProject = new StaticHostBuildProject(this, 'StaticHostTestBuildProject', {
      ...props,
      stage: 'test',
      role: codebuildRole,
      outputDirectory: props.projectEnv.buildOutputDir,
    })
    const s3syncTest = new PipelineS3Sync(this, 'S3SyncTest', {
      targetStack: `${props.projectEnv.stackNamePrefix}-test`,
      inputBuildArtifact: testBuildOutput,
    })
    const deployToTestAction = new CodeBuildAction({
      actionName: 'Build',
      project: deployToTestProject,
      input: appSourceArtifact,
      extraInputs: [infraSourceArtifact],
      runOrder: 1,
      outputs: [testBuildOutput],
    })

    // AUTOMATED QA
    const newmanRunner = new NewmanRunner(this, 'QAProject', {
      role: codebuildRole,
      collectionPath: props.projectEnv.smokeTestsCollection || props.smokeTestsPath,
      collectionVariables: {
        hostname: testHost,
        maxResponseTime: props.projectEnv.supportHtmlIncludes ? '5000' : '1000', // Transclusion is slow
      },
      actionName: 'SmokeTests',
      sourceArtifact: props.projectEnv.smokeTestsCollection ? appSourceArtifact : infraSourceArtifact,
    })

    // APPROVAL
    const approvalTopic = new sns.Topic(this, 'PipelineApprovalTopic', {
      displayName: 'PipelineApprovalTopic',
    })
    const manualApprovalAction = new ManualApprovalAction({
      actionName: 'ManualApprovalOfTestEnvironment',
      notificationTopic: approvalTopic,
      additionalInformation: 'Approve or Reject this change after testing',
      runOrder: 99, // Approval should always be last
    })
    if (props.slackNotifyStackName) {
      new SlackApproval(this, 'SlackApproval', {
        approvalTopic,
        notifyStackName: props.slackNotifyStackName,
      })
    }

    // TEST STAGE
    pipeline.addStage({
      stageName: 'DeployToTest',
      actions: [deployToTestAction, s3syncTest.action, newmanRunner.action, manualApprovalAction],
    })

    // DEPLOY TO PROD
    const prodBuildOutput = new codepipeline.Artifact('ProdBuild')
    const deployToProdProject = new StaticHostBuildProject(this, 'StaticHostProdBuildProject', {
      ...props,
      stage: 'prod',
      role: codebuildRole,
      outputDirectory: props.projectEnv.buildOutputDir,
    })
    const s3syncProd = new PipelineS3Sync(this, 'S3SyncProd', {
      targetStack: `${props.projectEnv.stackNamePrefix}-prod`,
      inputBuildArtifact: prodBuildOutput,
    })
    const deployToProdAction = new CodeBuildAction({
      actionName: 'Build',
      project: deployToProdProject,
      input: appSourceArtifact,
      extraInputs: [infraSourceArtifact],
      runOrder: 1,
      outputs: [prodBuildOutput],
    })

    // AUTOMATED QA
    const prodNewmanRunner = new NewmanRunner(this, 'QAProjectProd', {
      role: codebuildRole,
      collectionPath: props.projectEnv.smokeTestsCollection || props.smokeTestsPath,
      collectionVariables: {
        hostname: prodHost,
        maxResponseTime: props.projectEnv.supportHtmlIncludes ? '5000' : '1000', // Transclusion is slow
      },
      actionName: 'SmokeTests',
      sourceArtifact: props.projectEnv.smokeTestsCollection ? appSourceArtifact : infraSourceArtifact,
    })

    // PROD STAGE
    pipeline.addStage({
      stageName: 'DeployToProd',
      actions: [deployToProdAction, s3syncProd.action, prodNewmanRunner.action],
    })
  }
}

export default StaticHostPipelineStack
