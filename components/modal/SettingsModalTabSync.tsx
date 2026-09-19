import { useEffect, useState } from 'react'
import { Alert, View } from 'react-native'
import { NouText } from '../NouText'
import { Image } from 'expo-image'
import { useValue } from '@legendapp/state/react'
import { auth$ } from '@/states/auth'
import { isIos, isWeb, nIf } from '@/lib/utils'
import { openDeleteAccount, signOut } from '@/lib/supabase/auth'
import { prepareIosPurchase } from '@/lib/query'
import { deliverIosTransaction, IOS_SYNC_PRODUCT_ID } from '@/lib/ios-billing'
import { useMe } from '@/lib/hooks/useMe'
import NouBilling from '@/modules/nou-billing'
import { NouLink } from '../link/NouLink'
import { NouMenu } from '../menu/NouMenu'
import { capitalize } from 'es-toolkit'
import { t } from 'i18next'
import { MaterialButton } from '../button/IconButtons'
import { NouButton } from '../button/NouButton'

const surfaceCls =
  'overflow-hidden rounded-[24px] border border-zinc-300 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900/70'
const sectionLabelCls = 'mb-2 px-1 text-[11px] uppercase tracking-[0.18em] text-zinc-600 dark:text-zinc-500'
const TERMS_OF_USE_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/'
const PRIVACY_POLICY_URL = 'https://inks.page/p/privacy'

type BusyAction = 'buy' | 'restore' | 'manage'

const SettingsBadge: React.FC<{ label: string }> = ({ label }) => {
  return (
    <View className="rounded-full border border-zinc-300 dark:border-zinc-700 bg-zinc-200 dark:bg-zinc-950 px-3 py-1">
      <NouText className="text-xs text-zinc-700 dark:text-zinc-300">{label}</NouText>
    </View>
  )
}

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error))

export const SettingsModalTabSync = () => {
  const { user, userEmail, plan, accessToken } = useValue(auth$)
  const { me } = useMe()
  const planLabel = plan ? capitalize(plan) : t('sync.freePlan')
  const subscribed = Boolean(me?.plan && me.plan !== 'free')
  const viaAppStore = me?.source === 'app_store'
  const [loadingProduct, setLoadingProduct] = useState(isIos)
  const [productPrice, setProductPrice] = useState<string>()
  const [actionError, setActionError] = useState<string>()
  const [notice, setNotice] = useState<string>()
  const [busyAction, setBusyAction] = useState<BusyAction | null>(null)
  const restoreConflict = actionError?.startsWith('This App Store subscription is already linked to')

  useEffect(() => {
    if (!isIos || !user) {
      return
    }

    let active = true
    NouBilling.getProducts([IOS_SYNC_PRODUCT_ID])
      .then((products) => {
        if (active) {
          setProductPrice(products[0]?.displayPrice)
        }
      })
      .catch((error) => {
        if (active) {
          setActionError(getErrorMessage(error))
        }
      })
      .finally(() => {
        if (active) {
          setLoadingProduct(false)
        }
      })
    return () => {
      active = false
    }
  }, [user])

  const iosStatusText = me?.ios?.expiresAt
    ? t('sync.expiresAt', {
        value: new Date(me.ios.expiresAt).toLocaleString(),
        interpolation: { escapeValue: false },
      })
    : null

  const withBusyAction = async (action: BusyAction, run: () => Promise<void>) => {
    setBusyAction(action)
    setActionError(undefined)
    setNotice(undefined)
    try {
      await run()
    } catch (error) {
      const message = getErrorMessage(error)
      if (message.includes('Purchase pending approval')) {
        // Ask to Buy: the approved transaction arrives via Transaction.updates.
        setNotice(t('sync.purchasePending'))
      } else if (!message.includes('Purchase cancelled')) {
        // StoreKit reports a dismissed payment sheet as an error.
        setActionError(message)
      }
    } finally {
      setBusyAction(null)
    }
  }

  // The subscription follows the NouTube account, not the Apple ID, so make
  // the account it binds to explicit before StoreKit takes over.
  const confirmAccountBinding = () =>
    new Promise<boolean>((resolve) => {
      Alert.alert(t('sync.purchaseTitle'), t('sync.purchaseConfirm', { email: userEmail || user?.email }), [
        { text: t('buttons.cancel'), style: 'cancel', onPress: () => resolve(false) },
        { text: t('buttons.confirm'), onPress: () => resolve(true) },
      ])
    })

  const onPurchase = () =>
    withBusyAction('buy', async () => {
      if (!(await confirmAccountBinding())) {
        return
      }
      const { appAccountToken } = await prepareIosPurchase()
      const transaction = await NouBilling.purchase(IOS_SYNC_PRODUCT_ID, appAccountToken)
      await deliverIosTransaction(transaction)
    })

  const onRestore = () =>
    withBusyAction('restore', async () => {
      if (!(await confirmAccountBinding())) {
        return
      }
      await prepareIosPurchase()
      const entitlements = await NouBilling.restore()
      const entitlement = entitlements.find((entry) => entry.productId === IOS_SYNC_PRODUCT_ID)
      if (!entitlement) {
        throw new Error(t('sync.noPurchaseToRestore'))
      }
      await deliverIosTransaction(entitlement)
    })

  const onManageSubscriptions = () =>
    withBusyAction('manage', async () => {
      await NouBilling.manageSubscriptions()
    })

  const onDeleteAccount = async () => {
    setActionError(undefined)
    try {
      await openDeleteAccount(accessToken)
    } catch (error) {
      setActionError(getErrorMessage(error))
    }
  }

  const accountMenuItems = [
    ...(isIos && viaAppStore && subscribed
      ? [{ label: t('sync.manageIos'), handler: () => void onManageSubscriptions() }]
      : []),
    ...(isIos ? [{ label: t('sync.restore'), handler: () => void onRestore() }] : []),
    { label: t('sync.deleteAccount'), handler: () => void onDeleteAccount() },
    { label: t('buttons.signOut'), handler: signOut },
  ]

  if (!user) {
    return (
      <View className="gap-6">
        <View>
          <NouText className={sectionLabelCls}>{t('sync.label')}</NouText>
          <View className={surfaceCls}>
            <View className="px-5 py-5">
              <NouText className="text-lg font-semibold">{t('sync.label')}</NouText>
              <NouText className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{t('sync.hint')}</NouText>
              <View className="mt-5">
                <NouLink href="https://noutube.inks.page/auth/app" target="_blank">
                  <View className="items-center rounded-full bg-indigo-600 px-6 py-2 dark:bg-indigo-500">
                    <NouText className="text-white dark:text-white">Login NouTube</NouText>
                  </View>
                </NouLink>
              </View>
            </View>
          </View>
        </View>
      </View>
    )
  }

  return (
    <View className="gap-6">
      <View>
        <NouText className={sectionLabelCls}>{t('sync.label')}</NouText>
        <View className={surfaceCls}>
          <View className="flex-row items-center gap-3 px-4 py-4">
            <Image
              style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#18181b' }}
              source={user.picture}
              contentFit="cover"
            />
            <View className="flex-1">
              <NouText className="font-medium">{userEmail || user.email}</NouText>
              <NouText className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {t('sync.currentPlan')}: {planLabel}
              </NouText>
            </View>
            <NouMenu
              trigger={isWeb ? <MaterialButton name="more-vert" /> : isIos ? 'ellipsis' : 'filled.MoreVert'}
              items={accountMenuItems}
            />
          </View>
        </View>
      </View>

      <View>
        <NouText className={sectionLabelCls}>{t('sync.currentPlan')}</NouText>
        <View className={surfaceCls}>
          <View className="px-5 py-5">
            <View className="flex-row flex-wrap gap-2">
              <SettingsBadge label={planLabel} />
              {nIf(viaAppStore, <SettingsBadge label={t('sync.activeViaIos')} />)}
            </View>
            <NouText className="mt-4 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{t('sync.hint')}</NouText>
            {nIf(
              iosStatusText,
              <NouText className="mt-3 text-xs text-zinc-600 dark:text-zinc-500">{iosStatusText}</NouText>,
            )}
            {nIf(notice, <NouText className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{notice}</NouText>)}
            {nIf(actionError, <NouText className="mt-3 text-sm text-red-500">{actionError}</NouText>)}
            {nIf(
              restoreConflict,
              <View className="mt-3">
                <NouButton variant="outline" onPress={signOut}>
                  {t('sync.signOutSwitch')}
                </NouButton>
              </View>,
            )}
            {isIos ? (
              // App Review does not allow pointing iOS users at the web checkout.
              <View className="mt-5 gap-3">
                {nIf(
                  !subscribed,
                  <>
                    {nIf(
                      loadingProduct,
                      <NouText className="text-sm text-zinc-600 dark:text-zinc-400">{t('sync.priceLoading')}</NouText>,
                    )}
                    {nIf(
                      !loadingProduct && !productPrice,
                      <NouText className="text-sm text-zinc-600 dark:text-zinc-400">
                        {t('sync.productUnavailable')}
                      </NouText>,
                    )}
                    <NouButton
                      loading={busyAction === 'buy'}
                      disabled={loadingProduct || !productPrice || busyAction !== null}
                      onPress={() => void onPurchase()}
                    >
                      {productPrice ? `${t('sync.buy')} ${productPrice}` : t('sync.buy')}
                    </NouButton>
                  </>,
                )}
                {nIf(
                  busyAction === 'restore' || busyAction === 'manage',
                  <NouText className="text-sm text-zinc-600 dark:text-zinc-400">
                    {busyAction === 'manage' ? t('sync.manageIos') : t('sync.restore')}
                  </NouText>,
                )}
                <View className="gap-2 rounded-2xl border border-zinc-300 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-950/70 px-4 py-3">
                  <NouText className="text-xs leading-5 text-zinc-600 dark:text-zinc-400">
                    {t('sync.legalNotice')}
                  </NouText>
                  <View className="flex-row flex-wrap gap-3">
                    <NouLink href={TERMS_OF_USE_URL}>
                      <NouText className="text-xs text-zinc-900 dark:text-zinc-100 underline">
                        {t('sync.termsOfUse')}
                      </NouText>
                    </NouLink>
                    <NouLink href={PRIVACY_POLICY_URL}>
                      <NouText className="text-xs text-zinc-900 dark:text-zinc-100 underline">
                        {t('sync.privacyPolicy')}
                      </NouText>
                    </NouLink>
                  </View>
                </View>
              </View>
            ) : (
              <View className="mt-5">
                {viaAppStore ? (
                  <NouText className="text-sm text-zinc-600 dark:text-zinc-400">{t('sync.activeViaIos')}</NouText>
                ) : (
                  <NouLink href="https://noutube.inks.page/app">
                    <View className="items-center rounded-full border border-zinc-300 bg-zinc-100 px-5 py-2.5 dark:border-zinc-700 dark:bg-zinc-950">
                      <NouText className="text-sm text-zinc-900 dark:text-zinc-100">{t('sync.managePlan')}</NouText>
                    </View>
                  </NouLink>
                )}
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  )
}
