import config from './local-env'
import { ConfigInput } from './schema'

const cfg = { ...config, NODE_ENV: 'dev' } as ConfigInput

export default cfg
