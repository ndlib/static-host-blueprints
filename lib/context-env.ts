import { Environment } from '@aws-cdk/cx-api'
import { ConstructNode } from '@aws-cdk/core'
import { getRequiredContext } from './context-helpers'

export interface IContextEnv {
  readonly name: string
  readonly env: Environment
  readonly createDns: boolean
  readonly domainStackName?: string
  readonly slackNotifyStackName?: string
  readonly notificationReceivers?: string
  readonly webhookResourceStackName: string
}

export class ContextEnv implements IContextEnv {
  public readonly name: string
  public readonly env: Environment
  public readonly createDns: boolean
  public readonly domainStackName?: string
  public readonly slackNotifyStackName?: string
  public readonly notificationReceivers?: string
  public readonly webhookResourceStackName: string

  public static fromContext = (node: ConstructNode, name: string): IContextEnv => {
    const contextEnv = getRequiredContext(node, 'environments')[name]
    if (contextEnv === undefined || contextEnv === null) {
      throw new Error(`Context key 'environments.${name}' is required.`)
    }
    /* eslint-disable max-len */
    return {
      ...contextEnv,
      name: name,
      env: { account: contextEnv.account, region: contextEnv.region, name: contextEnv.name },
      createDns: node.tryGetContext(`environments:${name}:createDns`) || contextEnv.createDns || false,
      domainStackName: node.tryGetContext(`environments:${name}:domainStackName`) || contextEnv.domainStackName,
      slackNotifyStackName: node.tryGetContext(`environments:${name}:slackNotifyStackName`) || contextEnv.slackNotifyStackName,
      webhookResourceStackName: node.tryGetContext(`environments:${name}:webhookResourceStackName`) || contextEnv.webhookResourceStackName,
    }
    /* eslint-enable max-len */
  }
}

export default ContextEnv
