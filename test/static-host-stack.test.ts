import { expect as expectCDK, haveResource, haveResourceLike, exactValue, countResources } from '@aws-cdk/assert'
import cdk = require('@aws-cdk/core')
import { CfnDistribution } from '@aws-cdk/aws-cloudfront'
import { StaticHostStack } from '../lib/static-host-stack'

describe('StaticHostStack', () => {
  interface ISetupParams {
    stage?: string
    createDns?: boolean
    createSpaRedirects?: boolean
    supportHtmlIncludes?: boolean
    domainOverride?: {
      domainName: string
      certificateArnParam: string
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
          BucketName: 'static-host-test-site-123456789',
          LoggingConfiguration: {
            DestinationBucketName: {
              Ref: 'LogBucketCC3B17E8',
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
            DefaultCacheBehavior: {
              LambdaFunctionAssociations: exactValue([
                {
                  EventType: 'origin-request',
                  LambdaFunctionARN: {
                    Ref: 'SPARedirectionLambdaCurrentVersion18B130029709d27b5c5ffc216676c9a2331069e1',
                  },
                },
                {
                  EventType: 'origin-request',
                  LambdaFunctionARN: {
                    Ref: 'TransclusionLambdaCurrentVersion25DE5DA2dbdca68937811b65a7f0c4868eee772c',
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
            Ref: 'SiteBucket397A1860',
          },
          Description: 'Bucket where the stack website deploys to.',
          Name: '/all/stacks/static-host-test/site-bucket-name',
        }),
      )
    })

    test('outputs cloudfront distribution id to ssm parameter', () => {
      expectCDK(stack).to(
        haveResource('AWS::SSM::Parameter', {
          Type: 'String',
          Value: {
            Ref: 'DistributionCFDistribution882A7313',
          },
          Description: 'ID of the CloudFront distribution.',
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
              'Fn::GetAtt': ['DistributionCFDistribution882A7313', 'DomainName'],
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
            DefaultCacheBehavior: {
              LambdaFunctionAssociations: exactValue([]),
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
