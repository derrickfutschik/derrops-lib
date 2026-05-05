import { DerropsConventions } from '@derrops-conventions'
import { config, createConvention } from './config'

export const convention = createConvention({
  org: 'derrops',
  env: config['node.env'],
  region: config['aws.region'],
  accountId: config['aws.accountId'],
})
