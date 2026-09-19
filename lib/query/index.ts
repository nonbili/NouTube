import { UseQueryOptions } from '@tanstack/react-query'
import { auth$ } from '@/states/auth'

const HOST = 'https://a.inks.page'

export interface NoutubeIosEntitlement {
  status: string
  productId?: string | null
  expiresAt?: string | null
  willRenew?: boolean | null
  linkedEmail?: string | null
}

export interface NoutubeEntitlement {
  plan: string
  source: 'none' | 'stripe' | 'app_store'
  email?: string | null
  ios?: NoutubeIosEntitlement | null
}

export interface PrepareIosPurchaseResponse {
  appAccountToken: string
  email: string
  entitlement: NoutubeEntitlement
}

export interface SyncIosTransactionResponse {
  entitlement: NoutubeEntitlement
}

export interface WebAuthLinkResponse {
  token?: string | null
}

const defaultEntitlement: NoutubeEntitlement = {
  plan: 'free',
  source: 'none',
}

function getErrorMessage(payload: any, fallback?: string) {
  return payload?.error?.json?.message || payload?.message || fallback || 'Request failed'
}

async function callNoutubeApi<T>(
  path: string,
  init?: RequestInit,
  authorization = auth$.accessToken.get(),
): Promise<T> {
  const headers = new Headers(init?.headers)
  if (authorization) {
    headers.set('authorization', authorization)
  }
  const method = init?.method?.toUpperCase()
  if ((init?.body || (method && method !== 'GET' && method !== 'HEAD')) && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }

  const res = await fetch(`${HOST}/api/${path}`, {
    ...init,
    headers,
  })

  const rawText = await res.text()
  const payload = (() => {
    try {
      return rawText ? JSON.parse(rawText) : null
    } catch {
      return null
    }
  })()
  if (!res.ok || payload?.error) {
    const fallback = rawText ? `HTTP ${res.status}: ${rawText.slice(0, 200)}` : `HTTP ${res.status}`
    throw new Error(getErrorMessage(payload, fallback))
  }
  return payload?.result?.data as T
}

export const getMeQuery = (options?: Partial<UseQueryOptions<NoutubeEntitlement>>) => ({
  queryKey: ['me'],
  queryFn: async () => {
    if (!auth$.accessToken.get()) {
      return defaultEntitlement
    }
    return callNoutubeApi<NoutubeEntitlement>('noutube.me')
  },
  staleTime: 15 * 60 * 1000, // 15 minutes
  ...options,
})

export const fetchWebAuthLink = (accessToken: string) =>
  callNoutubeApi<WebAuthLinkResponse>('users.link', undefined, accessToken)

export const prepareIosPurchase = () =>
  callNoutubeApi<PrepareIosPurchaseResponse>('noutube.prepareIosPurchase', { method: 'POST' })

export const syncIosTransaction = (signedTransactionInfo: string) =>
  callNoutubeApi<SyncIosTransactionResponse>('noutube.syncIosTransaction', {
    method: 'POST',
    body: JSON.stringify({ signedTransactionInfo }),
  })
