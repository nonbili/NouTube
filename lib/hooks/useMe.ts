import { use$ } from '@legendapp/state/react'
import { auth$ } from '@/states/auth'
import { useQuery } from '@tanstack/react-query'
import { getMeQuery } from '@/lib/query'

export const useMe = () => {
  const userId = use$(auth$.userId)
  const { data: me } = useQuery(getMeQuery({ enabled: !!userId }))

  return { userId, me }
}
