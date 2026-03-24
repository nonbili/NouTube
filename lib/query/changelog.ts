import { fetchReleaseFeed } from '@/lib/changelog-feed'
import { parseReleaseFeed } from '@/lib/changelog'
import { isWeb } from '@/lib/utils'

export function getReleaseFeedQuery() {
  return {
    queryKey: ['release-feed', isWeb ? 'desktop' : 'mobile'],
    queryFn: async () => parseReleaseFeed(await fetchReleaseFeed()),
    staleTime: 60 * 60 * 1000,
  }
}
