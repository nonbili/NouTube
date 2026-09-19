import { NativeModule, requireNativeModule } from 'expo'
import { isIos } from '@/lib/utils'

export interface NouBillingProduct {
  id: string
  title: string
  description: string
  displayPrice: string
}

export interface NouBillingEntitlement {
  transactionId: string
  originalTransactionId: string
  productId: string
  purchaseDate: string
  expirationDate: string | null
  revocationDate: string | null
  appAccountToken: string | null
  environment: string | null
  signedTransactionInfo: string
}

type NouBillingEvents = {
  onTransactionUpdated: (transaction: NouBillingEntitlement) => void
}

declare class NouBillingModule extends NativeModule<NouBillingEvents> {
  getProducts(productIds: string[]): Promise<NouBillingProduct[]>
  /* Resolves with an unfinished transaction; call finishTransaction once the backend has it. */
  purchase(productId: string, appAccountToken: string): Promise<NouBillingEntitlement>
  restore(): Promise<NouBillingEntitlement[]>
  getUnfinishedTransactions(): Promise<NouBillingEntitlement[]>
  finishTransaction(transactionId: string): Promise<void>
  manageSubscriptions(): Promise<void>
}

const unsupportedError = () => Promise.reject(new Error('In-app purchases are only available on iOS'))

const NouBilling = isIos
  ? requireNativeModule<NouBillingModule>('NouBilling')
  : ({
      getProducts: unsupportedError,
      purchase: unsupportedError,
      restore: unsupportedError,
      getUnfinishedTransactions: unsupportedError,
      finishTransaction: unsupportedError,
      manageSubscriptions: unsupportedError,
      addListener: () => ({ remove: () => {} }),
    } as unknown as NouBillingModule)

export default NouBilling
