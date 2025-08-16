import { observable } from '@legendapp/state'
import { getBookmarkUrls } from './bookmarks'

interface Store {
  urls: () => Set<string>
}

export const library$ = observable<Store>({
  urls: (): Set<string> => {
    return getBookmarkUrls()
  },
})
