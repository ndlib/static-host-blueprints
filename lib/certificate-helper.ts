import { ICertificate, Certificate } from '@aws-cdk/aws-certificatemanager'
import { StringParameter } from '@aws-cdk/aws-ssm'
import { Construct, Fn } from '@aws-cdk/core'
import { OverrideStages } from './config'

export interface ICertificateHelperProps {
  readonly stage: string
  readonly domainStackName?: string
  readonly domainOverride?: {
    readonly domainName: string
    readonly certificateArnParam: string
    readonly stages: OverrideStages
  }
}

// Regardless of whether we're deploying the pipeline or service, we need to know the domain name.
// Imports have to be defined in a stack though, so that's why we have this reusable class.
// Determine domain based on either override from the settings, otherwise from the domain stack.
export class CertificateHelper {
  public readonly domainName: string
  public readonly websiteCertificate: ICertificate

  constructor(scope: Construct, id: string, props: ICertificateHelperProps) {
    if (props.domainOverride && (
      props.domainOverride.stages === OverrideStages.ALL ||
      (props.domainOverride.stages === OverrideStages.PROD && props.stage === 'prod') ||
      (props.domainOverride.stages === OverrideStages.TEST && props.stage === 'test')
    )) {
      const certificateArn = StringParameter.valueForStringParameter(scope, props.domainOverride.certificateArnParam)
      this.websiteCertificate = Certificate.fromCertificateArn(scope, `${id}_WebsiteCertificate`, certificateArn)
      this.domainName = props.domainOverride.domainName
    } else {
      const certificateArn = Fn.importValue(`${props.domainStackName}:ACMCertificateARN`)
      this.websiteCertificate = Certificate.fromCertificateArn(scope, `${id}_WebsiteCertificate`, certificateArn)
      this.domainName = Fn.importValue(`${props.domainStackName}:DomainName`)
    }
  }
}

export default CertificateHelper
