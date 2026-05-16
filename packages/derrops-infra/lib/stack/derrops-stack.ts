import { CfnOutput, Duration, RemovalPolicy, Stack, Tags, StackProps } from 'aws-cdk-lib'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as path from 'path'
import { Construct } from 'constructs'
import { resources } from '../names'
import { config } from '@derrops/config'
import { DerropsConventions } from '@derrops-conventions/DerropsConventions'
import { ResourceType } from '@derrops-conventions'



export abstract class DerropsStack extends Stack {

    constructor(protected conventions: DerropsConventions, scope: Construct, id: string, props?: StackProps) {
        super(scope, id, { ...props, stackName: conventions.name({ type: 'cloudFormationStack' }) })
        conventions.applyTags((k, v) => this.addStackTag(k, v))
    }

    protected resource = this.conventions.resource
    protected name = this.conventions.name

}