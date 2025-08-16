import { UseQueryOptions } from '@tanstack/react-query'
import { auth$ } from '@/states/auth'

const HOST = 'https://a.inks.page'

export const getMeQuery = (options?: Partial<UseQueryOptions<{ plan: string }>>) => ({
  queryKey: ['me'],
  queryFn: async () => {
    const authorization = auth$.accessToken.get()
    if (!authorization) {
      return { plan: 'free' }
    }
    const res = await fetch(`${HOST}/api/noutube.me`, {
      headers: {
        authorization,
      },
    })
    const data = await res.json()
    return data?.result?.data
  },
  staleTime: 15 * 60 * 1000, // 15 minutes
  ...options,
})
