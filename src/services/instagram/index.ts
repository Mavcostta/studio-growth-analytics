import { posts } from '../../mocks/posts'
import type { SocialPost } from '../../types/analytics'

// MOCK: substituir a origem por nosso backend quando a integração for autorizada.
export function getPosts(): SocialPost[] {
  return posts
}
