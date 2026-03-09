import { ConfigInput } from './schema'

const devServer = '192.168.7.233'

const cfg: ConfigInput = {
  NODE_ENV: 'local',

  DB_HOST: devServer,
  DB_PORT: 5432,

  DB_USERNAME: 'postgres',
  DB_PASSWORD: 'postgres',

  AWS_S3_ENDPOINT: `http://${devServer}:9000`,
  AWS_REGION: 'ap-southeast-2',
  AWS_ACCOUNT_ID: '123456789012',

  OPENSEARCH_ENDPOINT: `http://${devServer}:9200`,
  DYNAMODB_ENDPOINT: `http://${devServer}:4566`,
}

export default cfg
