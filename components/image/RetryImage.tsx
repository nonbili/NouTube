import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { Image, type ImageProps, type ImageSource } from 'expo-image'
import { memo, useEffect, useMemo, useState } from 'react'
import { Pressable, View } from 'react-native'

function withRetryToken(source: ImageProps['source'], retryKey: number): ImageProps['source'] {
  if (!retryKey || !source) {
    return source
  }

  if (typeof source === 'string') {
    return appendRetryToken(source, retryKey)
  }

  if (typeof source === 'number' || Array.isArray(source)) {
    return source
  }

  if (!source.uri) {
    return source
  }

  return {
    ...source,
    uri: appendRetryToken(source.uri, retryKey),
    cacheKey: source.cacheKey ? `${source.cacheKey}:${retryKey}` : undefined,
  } satisfies ImageSource
}

function appendRetryToken(uri: string, retryKey: number) {
  try {
    const url = new URL(uri)
    url.searchParams.set('reload', `${retryKey}`)
    return url.toString()
  } catch {
    const suffix = uri.includes('?') ? '&' : '?'
    return `${uri}${suffix}reload=${retryKey}`
  }
}

function canRetrySource(source: ImageProps['source']) {
  if (!source) {
    return false
  }
  if (typeof source === 'string') {
    return source.startsWith('http://') || source.startsWith('https://')
  }
  if (typeof source === 'number' || Array.isArray(source)) {
    return false
  }
  return !!source.uri && (source.uri.startsWith('http://') || source.uri.startsWith('https://'))
}

export const RetryImage: React.FC<ImageProps> = memo(({ cachePolicy, onError, onLoad, recyclingKey, ...props }) => {
  const { source } = props
  const [retryKey, setRetryKey] = useState(0)
  const [failed, setFailed] = useState(false)
  const [autoRetried, setAutoRetried] = useState(false)
  const retryable = canRetrySource(source)

  useEffect(() => {
    setRetryKey(0)
    setFailed(false)
    setAutoRetried(false)
  }, [source])

  const resolvedSource = useMemo(() => withRetryToken(source, retryKey), [source, retryKey])

  const retry = () => {
    if (!retryable) {
      return
    }
    setFailed(false)
    setRetryKey((value) => value + 1)
  }

  return (
    <View>
      <Image
        {...props}
        source={resolvedSource}
        cachePolicy={retryKey > 0 ? 'none' : cachePolicy}
        recyclingKey={recyclingKey ? `${recyclingKey}:${retryKey}` : `${retryKey}`}
        onError={(event) => {
          onError?.(event)
          if (retryable && !autoRetried) {
            setAutoRetried(true)
            setRetryKey((value) => value + 1)
            return
          }
          setFailed(true)
        }}
        onLoad={(event) => {
          setFailed(false)
          onLoad?.(event)
        }}
      />
      {failed && retryable ? (
        <Pressable
          onPress={retry}
          className="absolute bottom-2 right-2 h-8 w-8 items-center justify-center rounded-full bg-black/75"
          hitSlop={8}
        >
          <MaterialIcons name="refresh" color="white" size={16} />
        </Pressable>
      ) : null}
    </View>
  )
})

RetryImage.displayName = 'RetryImage'
