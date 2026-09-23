// SRIJAN Supabase client configuration.
// Replace these two public values with your Supabase Project URL and anon/publishable key.
// Never put the Supabase service-role key in this file or any browser code.
export const SUPABASE_URL = "YOUR_SUPABASE_PROJECT_URL";
export const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY";

export const isSupabaseConfigured = () =>
  SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("YOUR_") &&
  SUPABASE_ANON_KEY &&
  !SUPABASE_ANON_KEY.includes("YOUR_");
