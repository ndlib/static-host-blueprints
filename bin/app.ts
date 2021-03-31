import 'source-map-support/register'
import { App, Aspects } from '@aws-cdk/core'
import { StackTags } from '@ndlib/ndlib-cdk'
import { getRequiredContext, getContextByNamespace } from '../lib/context-helpers'
import { ContextEnv } from '../lib/context-env'
import { StaticHostStack } from '../lib/static-host-stack'
import { StaticHostPipelineStack } from '../lib/static-host-pipeline'
import Config from '../lib/config'

const app = new App()
Aspects.of(app).add(new StackTags())

const envName = getRequiredContext(app.node, 'env')
const contextEnv = ContextEnv.fromContext(app.node, envName)

const validProjects = Object.keys(Config)
const projectKey = getRequiredContext(app.node, 'project')
if (!validProjects.includes(projectKey)) {
  throw new Error(`Unable to find defaults for project "${projectKey}". Valid options: ${validProjects.join(', ')}`)
}

// Get the default values from Config. Override with context using namespaced keys like "hackathon:hostnamePrefix"
const projectEnv = Config[projectKey]
Object.assign(projectEnv, getContextByNamespace(projectKey))

const stackType = getRequiredContext(app.node, 'stackType')
if (!['service', 'pipeline'].includes(stackType)) {
  throw new Error('Context value stackType should be either "service" or "pipeline"')
}

if (stackType === 'service') {
  const stage = getRequiredContext(app.node, 'stage')
  const stackName = `${projectEnv.stackNamePrefix}-${stage}`
  new StaticHostStack(app, stackName, {
    stage: stage,
    contextEnvName: envName,
    ...contextEnv,
    ...projectEnv,
  })
} else {
  const pipelineName = `${projectEnv.stackNamePrefix}-pipeline`
  new StaticHostPipelineStack(app, pipelineName, {
    projectEnv,
    projectName: projectKey,
    contextEnvName: envName,
    contact: getRequiredContext(app.node, 'contact'),
    owner: getRequiredContext(app.node, 'owner'),
    gitTokenPath: getRequiredContext(app.node, 'gitTokenPath'),
    infraRepoOwner: getRequiredContext(app.node, 'infraRepoOwner'),
    infraRepoName: getRequiredContext(app.node, 'infraRepoName'),
    infraSourceBranch: getRequiredContext(app.node, 'infraSourceBranch'),
    smokeTestsPath: getRequiredContext(app.node, 'smokeTestsPath'),
    ...contextEnv,
  })
}
