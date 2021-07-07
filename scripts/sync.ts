/*
 * USED FOR DEVELOPMENT PURPOSES
 * This script will sync up a local site build (or static site) to an s3 bucket.
 * Run with yarn sync <projectName> AFTER you have deployed an appropriate service stack for the project.
 * Accepts stackName as an optional argument in case you overwrote the default stack name in these blueprints.
 */
import AWS = require('aws-sdk')
const ssm = new AWS.SSM({ apiVersion: '2014-11-06', region: 'us-east-1' })
import { execSync } from 'child_process'
import path = require('path')
import Config from '../lib/config'

const handler = async () => {
  const args = process.argv.slice(2)

  const validProjects = Object.keys(Config)
  const helpText = `Usage: sync <${validProjects.join('|')}> [stackName]`
  if (!args.length || !validProjects.includes(args[0])) {
    console.error('Invalid project name.')
    throw new Error(helpText)
  }
  const projectKey = args[0]
  const projectConfig = Config[projectKey]

  process.env.STAGE = process.env.STAGE || 'dev' // Needed for finding appropriate bucket name
  process.env.STACK_NAME = process.env.STACK_NAME || `${projectConfig.stackNamePrefix}-${process.env.STAGE}`

  if (args.length > 1 && args[1]) {
    process.env.STACK_NAME = args[1]
  }

  console.log('Getting parameters for stack:', process.env.STACK_NAME)

  const bucketNameParamPath = `/all/stacks/${process.env.STACK_NAME}/site-bucket-name`
  const distributionIdParamPath = `/all/stacks/${process.env.STACK_NAME}/distribution-id`
  const bucketNameParam = await ssm.getParameter({ Name: bucketNameParamPath }).promise()
  const distributionIdParam = await ssm.getParameter({ Name: distributionIdParamPath }).promise()

  if (bucketNameParam.Parameter && distributionIdParam.Parameter) {
    process.env.DEST_BUCKET = bucketNameParam.Parameter.Value
    process.env.DISTRIBUTION_ID = distributionIdParam.Parameter.Value
    process.env.APP_ROOT = path.join(__dirname, `../../${projectConfig.appRepoName}`)
    process.env.BUILD_PATH = path.join(process.env.APP_ROOT, projectConfig.buildOutputDir || '')

    const scripts = projectConfig.buildScripts || []
    if (scripts.length) {
      console.log(`Building app at ${process.env.APP_ROOT}... Please wait.`)

      scripts.forEach((script) => {
        execSync(`cd "$APP_ROOT" && chmod -R 755 "./${script}" && "./${script}"`, { stdio: 'inherit' })
      })
    }

    // Remove existing files first
    execSync(`aws s3 rm s3://$DEST_BUCKET --recursive`, { stdio: 'inherit' })
    // Copy the new build up to s3
    execSync(`aws s3 cp --recursive "$BUILD_PATH" s3://$DEST_BUCKET --include "*" --exclude "*.shtml"`, { stdio: 'inherit' })
    execSync(`aws s3 cp --recursive "$BUILD_PATH" s3://$DEST_BUCKET --exclude "*" --include "*.shtml" --content-type "text/html"`, { stdio: 'inherit' })
  } else {
    if (!bucketNameParam.Parameter) {
      console.error(`Failed to get parameter ${bucketNameParamPath}`)
    }
    if (!distributionIdParam.Parameter) {
      console.error(`Failed to get parameter ${distributionIdParamPath}`)
    }
    throw new Error()
  }
}

handler()
