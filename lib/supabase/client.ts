import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || 'https://pgukcvgypvjwtibzlvhr.supabase.co',
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBndWtjdmd5cHZqd3RpYnpsdmhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTI0NTIzODQsImV4cCI6MjAyODAyODM4NH0.zoxse4Kay_svHlQOiAINZm1lPIFPJMZAY8RKZUDSQrs',
)
