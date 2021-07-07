import * as path from 'path'
import * as fs from 'fs'
import { CfnDistribution } from '@aws-cdk/aws-cloudfront'
import { PolicyStatement } from '@aws-cdk/aws-iam'
import { BuildEnvironmentVariable } from '@aws-cdk/aws-codebuild'
import { Duration } from '@aws-cdk/core'
import { OverrideStages } from './constants'

export interface IProjectDefaults {
  readonly stackNamePrefix: string
  readonly hostnamePrefix?: string
  readonly domainOverride?: {
    readonly domainName: string
    readonly certificateArnParam: string
    readonly stages: OverrideStages
  }
  readonly appRepoOwner: string
  readonly appRepoName: string
  readonly appSourceBranch: string
  readonly createWebhook: boolean
  readonly createSpaRedirects: boolean
  readonly supportHtmlIncludes: boolean
  readonly buildScripts?: string[]
  readonly buildOutputDir?: string
  readonly smokeTestsCollection?: string
  readonly smokeTestsResponseTime?: number
  readonly indexFilename?: string
  readonly cacheTtl?: Duration
  readonly errorConfig?: CfnDistribution.CustomErrorResponseProperty[]
  readonly deploymentPolicies?: PolicyStatement[]
  readonly buildEnvironmentVariables?: {
    [key: string]: BuildEnvironmentVariable
  }
}

export interface IConfig {
  [key: string]: IProjectDefaults
}

// Project-specific default values should be set here. They can still be overridden with context,
// but it's easier to manage here with type-checking goodness.
// Build out the config dictionary using the filenames of the config files as keys.
const projectsPath = path.join(__dirname, 'projects')
const files = fs.readdirSync(projectsPath)
const projectConfig: IConfig = {}
files.forEach(filename => {
  const fileNoExtension = path.parse(filename).name
  projectConfig[fileNoExtension] = require(path.join(projectsPath, filename)).default
})

export const Config: IConfig = projectConfig
export default Config
