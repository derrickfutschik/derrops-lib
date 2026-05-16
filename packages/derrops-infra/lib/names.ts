import { config } from '@derrops/config'

const convention = config.convention.with({ domain: 'user-management', service: 'cognito' })

export const resources = {
  userpoolStack: convention.resource({ type: 'cloudFormationStack' }),
  userpool: convention.resource({ type: 'cognitoUserPool' }),
}
