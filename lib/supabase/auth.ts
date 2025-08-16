import { supabase } from './client'

export const signOut = () => supabase.auth.signOut({ scope: 'local' })

export const signInWithGoogle = () => {
  throw 'noop'
}
