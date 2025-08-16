import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://pgukcvgypvjwtibzlvhr.supabase.co',
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBndWtjdmd5cHZqd3RpYnpsdmhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTI0NTIzODQsImV4cCI6MjAyODAyODM4NH0.zoxse4Kay_svHlQOiAINZm1lPIFPJMZAY8RKZUDSQrs',
  {
    auth: {
      // https://github.com/supabase/supabase-js/issues/870#issuecomment-1746699664
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
)
