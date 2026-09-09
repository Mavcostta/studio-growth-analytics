import { functionHandler } from '../../../server/function-handler.js'
import { getInstagramAccount } from '../../../server/integrations/instagram/account.js'

export default functionHandler(getInstagramAccount)
