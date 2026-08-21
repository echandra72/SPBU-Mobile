import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Sama persis dengan js/config.js di Next-BO-ERP (web) — 1 backend, 1 database.
const SUPABASE_URL = 'https://ejrsgjnjjyegpitccrfc.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcnNnam5qanllZ3BpdGNjcmZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2OTI5NjEsImV4cCI6MjA5NTI2ODk2MX0.rGVC8NN21Ba8t_ZFJh3opVvv5oGH2VopRytdVeQom0k';

// App ini TIDAK pakai Supabase Auth (web existing juga tidak) — login custom
// lewat tabel m_users (lihat lib/auth.ts). Client ini murni dipakai sebagai
// query builder REST ke PostgREST dengan anon key yang sama seperti web.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});
