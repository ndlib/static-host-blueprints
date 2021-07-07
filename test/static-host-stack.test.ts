import {
  expect as expectCDK,
  haveResource,
  haveResourceLike,
  exactValue,
  countResources,
  stringLike,
  ABSENT,
} from '@aws-cdk/assert'
import cdk = require('@aws-cdk/core')
import { CfnDistribution } from '@aws-cdk/aws-cloudfront'
import { StaticHostStack } from '../lib/static-host-stack'
import { OverrideStages } from '../lib/config/constants'

describe('StaticHostStack', () => {
  interface ISetupParams {
    stage?: string
    createDns?: boolean
    createSpaRedirects?: boolean
    supportHtmlIncludes?: boolean
    domainOverride?: {
      domainName: string
      certificateArnParam: string
      stages: OverrideStages
    }
    errorConfig?: CfnDistribution.CustomErrorResponseProperty[]
  }

  const setup = (props: ISetupParams) => {
    const app = new cdk.App()
    const myStack = new StaticHostStack(app, 'TestStack', {
      env: {
        account: '123456789',
        region: 'us-east-1',
      },
      contextEnvName: 'dev',
      stage: props.stage || 'test',
      stackNamePrefix: 'static-host',
      stackName: `static-host-${props.stage || 'test'}`,
      hostnamePrefix: 'hostname',
      createDns: props.createDns ?? true,
      createSpaRedirects: props.createSpaRedirects ?? true,
      supportHtmlIncludes: props.supportHtmlIncludes ?? true,
      domainStackName: 'some-domain-stack',
      domainOverride: props.domainOverride,
      indexFilename: 'index.html',
      errorConfig: props.errorConfig,
    })
    return myStack
  }

  describe('default props', () => {
    const stack = setup({})

    test('creates an s3 bucket for the site contents', () => {
      expectCDK(stack).to(
        haveResourceLike('AWS::S3::Bucket', {
          LoggingConfiguration: {
            DestinationBucketName: {
              Ref: 'StaticHostLogBucket3A82CF66',
            },
            LogFilePrefix: {
              'Fn::Join': [
                '',
                [
                  's3/hostname-test.',
                  {
                    'Fn::ImportValue': 'some-domain-stack:DomainName',
                  },
                  '/',
                ],
              ],
            },
          },
        }),
      )
    })

    test('creates a cloudfront with an appropriate domain name', () => {
      expectCDK(stack).to(
        haveResourceLike('AWS::CloudFront::Distribution', {
          DistributionConfig: {
            Aliases: [
              {
                'Fn::Join': [
                  '',
                  [
                    'hostname-test.',
                    {
                      'Fn::ImportValue': 'some-domain-stack:DomainName',
                    },
                  ],
                ],
              },
            ],
            DefaultRootObject: 'index.html',
          },
        }),
      )
    })

    test('associates spaRedirect and transclusion lambdas with cloudfront', () => {
      expectCDK(stack).to(
        haveResourceLike('AWS::CloudFront::Distribution', {
          DistributionConfig: {
            CacheBehaviors: [
              {
                LambdaFunctionAssociations: exactValue([
                  {
                    EventType: 'origin-request',
                    LambdaFunctionARN: {
                      Ref: stringLike('TransclusionLambdaFunctionCurrentVersion*'),
                    },
                  },
                ]),
              },
            ],
            DefaultCacheBehavior: {
              LambdaFunctionAssociations: exactValue([
                {
                  EventType: 'origin-request',
                  LambdaFunctionARN: {
                    Ref: stringLike('SPARedirectionLambdaFunctionCurrentVersion*'),
                  },
                },
              ]),
            },
          },
        }),
      )
    })

    test('outputs s3 bucket name to ssm parameter', () => {
      expectCDK(stack).to(
        haveResource('AWS::SSM::Parameter', {
          Type: 'String',
          Value: {
            Ref: stringLike('StaticHostSiteBucket*'),
          },
          Name: '/all/stacks/static-host-test/site-bucket-name',
        }),
      )
    })

    test('outputs cloudfront distribution id to ssm parameter', () => {
      expectCDK(stack).to(
        haveResource('AWS::SSM::Parameter', {
          Type: 'String',
          Value: {
            Ref: stringLike('StaticHostDistributionCFDistribution*'),
          },
          Name: '/all/stacks/static-host-test/distribution-id',
        }),
      )
    })

    test('creates a route53 record for the domain', () => {
      expectCDK(stack).to(
        haveResourceLike('AWS::Route53::RecordSet', {
          Name: {
            'Fn::Join': [
              '',
              [
                'hostname-test.',
                {
                  'Fn::ImportValue': 'some-domain-stack:DomainName',
                },
                '.',
              ],
            ],
          },
          Type: 'CNAME',
          Comment: {
            'Fn::Join': [
              '',
              [
                'hostname-test.',
                {
                  'Fn::ImportValue': 'some-domain-stack:DomainName',
                },
              ],
            ],
          },
          HostedZoneId: {
            'Fn::ImportValue': 'some-domain-stack:Zone',
          },
          ResourceRecords: [
            {
              'Fn::GetAtt': [stringLike('StaticHostDistributionCFDistribution*'), 'DomainName'],
            },
          ],
        }),
      )
    })
  })

  describe('overridden props', () => {
    const stack = setup({
      stage: 'prod',
      createDns: false,
      createSpaRedirects: false,
      supportHtmlIncludes: false,
      domainOverride: {
        domainName: 'example.com',
        certificateArnParam: 'arn::foo:bar',
        stages: OverrideStages.PROD,
      },
      errorConfig: [
        {
          errorCode: 403,
          responseCode: 404,
          responsePagePath: '/404.html',
          errorCachingMinTtl: 300,
        },
      ],
    })

    test('overrides domain and certificate properties for cloudfront', () => {
      expectCDK(stack).to(
        haveResourceLike('AWS::CloudFront::Distribution', {
          DistributionConfig: {
            Aliases: ['hostname.example.com'],
            DefaultRootObject: 'index.html',
            ViewerCertificate: {
              AcmCertificateArn: {
                Ref: 'SsmParameterValuearnfoobarC96584B6F00A464EAD1953AFF4B05118Parameter',
              },
            },
          },
        }),
      )
    })

    test('does not include lambda associations in cloudfront', () => {
      expectCDK(stack).to(
        haveResourceLike('AWS::CloudFront::Distribution', {
          DistributionConfig: {
            CacheBehaviors: ABSENT,
            DefaultCacheBehavior: {
              LambdaFunctionAssociations: ABSENT,
            },
          },
        }),
      )
    })

    test('includes error configuration with cloudfront', () => {
      expectCDK(stack).to(
        haveResourceLike('AWS::CloudFront::Distribution', {
          DistributionConfig: {
            CustomErrorResponses: exactValue([
              {
                ErrorCachingMinTTL: 300,
                ErrorCode: 403,
                ResponseCode: 404,
                ResponsePagePath: '/404.html',
              },
            ]),
          },
        }),
      )
    })

    test('does not create a route53 record for the domain', () => {
      expectCDK(stack).to(countResources('AWS::Route53::RecordSet', 0))
    })
  })
})
