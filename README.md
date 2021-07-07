# static-host-blueprints
Infrastructure for deploying static websites in a repeatable fashion to be hosted in AWS.

## Deployment

`env` context variable refers to the AWS account being targetted.
`project` is an identifier for the sites that have been configured to be handled with this blueprint. Refer to [lib/config.ts](lib/config.ts) for the list of projects and their default configurations. (Update this config file if adding a new project.)

### Pipeline
```
cdk deploy -c env=<dev|prod> -c project=<projectName> -c stackType=pipeline -c slackNotifyStackName=[stackName] --all
```

### Service Stack

For simplest deployment without overriding any default parameters, run:
```
cdk deploy -c env=<dev|prod> -c project=<projectName>
```

This will deploy to the `dev` stack. Pass `-c stage=[stageName]` if you want to deploy a different instance.

**After deploying stack, you will probably want to build/upload the app to the bucket!** To do so, run `yarn sync <projectName>` This is only necessary for locally deployed instances, of course; the pipeline will handle syncing site changes automatically with the repository it is targeting.

## Useful commands

 * `yarn build`     compile typescript to js
 * `yarn watch`     watch for changes and compile
 * `yarn test`      perform the jest unit tests
 * `yarn lint`      lint code to find formatting violations
 * `yarn format`    run lint and auto-fix violations when possible
 * `yarn sync`      builds (if necessary) and uploads site files to s3 after stack has been deployed
 * `cdk deploy`     deploy this stack to your default AWS account/region
 * `cdk diff`       compare deployed stack with current state
 * `cdk synth`      emits the synthesized CloudFormation template
