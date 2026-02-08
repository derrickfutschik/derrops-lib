import config from './local-env'
import { ConfigInput } from './schema'

const cfg = { ...config, NODE_ENV: 'test' } as ConfigInput

export default cfg
