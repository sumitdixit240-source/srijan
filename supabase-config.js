// Browser-safe Supabase configuration only.
// For Vercel production, npm run build generates this file from environment variables.
export const SUPABASE_URL = "YOUR_SUPABASE_PROJECT_URL";
export const SUPABASE_PUBLISHABLE_KEY = "YOUR_SUPABASE_PUBLISHABLE_KEY";
export const SUPABASE_ANON_KEY = SUPABASE_PUBLISHABLE_KEY;
export const isSupabaseConfigured = () =>
  /^https:\/\//.test(SUPABASE_URL) && !SUPABASE_URL.includes('YOUR_') && /^sb_publishable_/.test(SUPABASE_PUBLISHABLE_KEY);
