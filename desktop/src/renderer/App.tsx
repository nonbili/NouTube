import contentJs from 'noutube/assets/scripts/main.bjs?raw'
import { MainPage } from 'noutube/components/page/MainPage'
import { Toaster } from 'react-hot-toast'
import { bookmarks$, migrateWatchlist } from '@/states/bookmarks'
import { useObserveEffect } from '@legendapp/state/react'
import { useEffect } from 'react'
import { initUiChannel } from './ipc/ui'

function App(): React.JSX.Element {
  useEffect(() => {
    initUiChannel()
  }, [])

  return (
    <>
      <MainPage contentJs={contentJs} />
      <Toaster position="bottom-right" />
    </>
  )
}
export default App
