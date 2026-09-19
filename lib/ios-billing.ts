import NouBilling, { type NouBillingEntitlement } from '@/modules/nou-billing'
import { syncIosTransaction } from '@/lib/query'
import { queryClient } from '@/lib/query/client'
import { createLogger } from '@/lib/log'
import { isIos } from '@/lib/utils'
import { auth$ } from '@/states/auth'

export const IOS_SYNC_PRODUCT_ID = 'jp.nonbili.noutube.sync'

const logger = createLogger('ios-billing')
const delivering = new Map<string, Promise<void>>()

// A transaction is finished only after the backend has recorded it, so a
// failed request or a killed app leaves it in Transaction.unfinished for
// reconcileIosTransactions to deliver again.
export function deliverIosTransaction(transaction: NouBillingEntitlement) {
  let request = delivering.get(transaction.transactionId)
  if (!request) {
    request = (async () => {
      await syncIosTransaction(transaction.signedTransactionInfo)
      await NouBilling.finishTransaction(transaction.transactionId)
      await queryClient.invalidateQueries({ queryKey: ['me'] })
    })().finally(() => delivering.delete(transaction.transactionId))
    delivering.set(transaction.transactionId, request)
  }
  return request
}

const deliverInBackground = async (transaction: NouBillingEntitlement) => {
  if (transaction.productId !== IOS_SYNC_PRODUCT_ID || !auth$.accessToken.peek()) {
    return
  }
  try {
    await deliverIosTransaction(transaction)
  } catch (error) {
    logger.error(`failed to deliver transaction ${transaction.transactionId}`, error)
  }
}

export async function reconcileIosTransactions() {
  if (!isIos || !auth$.accessToken.peek()) {
    return
  }
  try {
    const transactions = await NouBilling.getUnfinishedTransactions()
    for (const transaction of transactions) {
      await deliverInBackground(transaction)
    }
  } catch (error) {
    logger.error('failed to read unfinished transactions', error)
  }
}

export function listenIosTransactions() {
  if (!isIos) {
    return () => {}
  }
  const subscription = NouBilling.addListener('onTransactionUpdated', (transaction) => {
    void deliverInBackground(transaction)
  })
  return () => subscription.remove()
}
