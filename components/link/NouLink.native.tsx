import { Href, Link } from 'expo-router'
import { openAuthSessionAsync, openBrowserAsync } from 'expo-web-browser'
import { cssInterop } from 'nativewind'
import { type ComponentProps } from 'react'
import { onReceiveAuthUrl } from '@/lib/supabase/auth'

// Link renders a Text; let className style it like any other Text.
cssInterop(Link, { className: 'style' })

type Props = Omit<ComponentProps<typeof Link>, 'href'> & { href: Href & string }

export const NouLink: React.FC<Props> = ({ href, ...rest }) => {
  return (
    <Link
      target="_blank"
      {...rest}
      href={href}
      onPress={async (event) => {
        event.preventDefault()
        try {
          if (href.includes('/auth/')) {
            // An auth session dismisses itself once the page redirects to
            // noutube:auth and hands the url back here; a plain browser sheet
            // is left over the app on iOS.
            const result = await openAuthSessionAsync(href, 'noutube:auth')
            if (result.type === 'success' && result.url) {
              onReceiveAuthUrl(result.url)
            }
          } else {
            await openBrowserAsync(href)
          }
        } catch (error) {
          console.warn('Failed to open link', error)
        }
      }}
    />
  )
}
