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
}

export class ContextEnv implements IContextEnv {
  public readonly name: string
  public readonly env: Environment
  public readonly createDns: boolean
  public readonly domainStackName?: string
  public readonly slackNotifyStackName?: string
  public readonly notificationReceivers?: string

  public static fromContext = (node: ConstructNode, name: string): IContextEnv => {
    const contextEnv = getRequiredContext(node, 'environments')[name]
    if (contextEnv === undefined || contextEnv === null) {
      throw new Error(`Context key 'environments.${name}' is required.`)
    }
    return {
      name: name,
      env: { account: contextEnv.account, region: contextEnv.region, name: contextEnv.name },
      createDns: contextEnv.createDns || false,
      // This should only include optional values
      ...contextEnv,
    }
  }
}

export default ContextEnv
