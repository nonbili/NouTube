import { Href, Link } from 'expo-router'
import { openBrowserAsync } from 'expo-web-browser'
import { type ComponentProps } from 'react'
import { Platform } from 'react-native'

type Props = Omit<ComponentProps<typeof Link>, 'href'> & { href: Href & string }

export const NouLink: React.FC<Props> = ({ href, ...rest }) => {
  return (
    <Link
      target="_blank"
      {...rest}
      href={href}
      onPress={(event) => {
        event.preventDefault()
        openBrowserAsync(href)
      }}
    />
  )
}
