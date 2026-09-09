import { functionHandler } from '../../../server/function-handler.js'
import { testAnalytics } from '../../../server/integrations/analytics/index.js'

export default functionHandler(testAnalytics)
