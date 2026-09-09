import { functionHandler } from '../../../server/function-handler.js'
import { getInstagramPosts } from '../../../server/integrations/instagram/posts.js'

export default functionHandler(getInstagramPosts)
