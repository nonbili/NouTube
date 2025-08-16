import { UserMetadata } from '@supabase/supabase-js'
import { observable } from '@legendapp/state'

interface Store {
  loaded: boolean
  userId: string | undefined
  user: UserMetadata | undefined
  accessToken: string
  plan: string | undefined
}

export const auth$ = observable<Store>({
  loaded: false,
  userId: undefined,
  user: undefined,
  accessToken: '',
  plan: undefined,
})
