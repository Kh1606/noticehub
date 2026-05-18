import { createClient } from '@supabase/supabase-js'

// Publishable key — safe to ship in the browser bundle.
// Read-only access via the "anon read" RLS policy on `notices`.
const SUPABASE_URL = 'https://fjxbwerapxmgppqlpmhw.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_NgVG3uU-hSg5jT0WSsdYFQ_0rzWzM4f'

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
