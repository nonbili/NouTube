import { ReactNode } from 'react'

export interface TabMenuItem {
  label: string
  handler: () => void
  color?: string
}

// Tabs only render on web; on native this is a pass-through.
export const TabContextMenu: React.FC<{ children: ReactNode; items: TabMenuItem[] }> = ({ children }) => {
  return <>{children}</>
}
