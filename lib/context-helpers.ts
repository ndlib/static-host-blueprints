import { ConstructNode } from '@aws-cdk/core'

const allContext = JSON.parse(process.env.CDK_CONTEXT_JSON ?? '{}')

// Globs all kvp from context of the form "namespace:key": "value"
// and flattens it to an object of the form "key": "value"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getContextByNamespace = (ns: string): { [key: string]: any } => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: { [key: string]: any } = {}
  const prefix = `${ns}:`
  for (const [key, value] of Object.entries(allContext)) {
    if (key.startsWith(prefix)) {
      const flattenedKey = key.substr(prefix.length)
      result[flattenedKey] = value
    }
  }
  return result
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getRequiredContext = (node: ConstructNode, key: string): any => {
  const value = node.tryGetContext(key)
  if (value === undefined || value === null) {
    throw new Error(`Context key '${key}' is required.`)
  }
  return value
}
