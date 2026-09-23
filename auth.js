import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from "./supabase-config.js";

export const supabase = isSupabaseConfigured()
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    })
  : null;

export async function requireUser(redirect = "auth.html") {
  if (!supabase) { location.href = redirect + "?setup=1"; return null; }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { location.href = redirect; return null; }
  return user;
}

export async function requireAdmin(redirect = "auth.html") {
  const user = await requireUser(redirect);
  if (!user) return null;
  const { data: profile, error } = await supabase.from("profiles").select("id,full_name,email,role,status").eq("id", user.id).single();
  if (error || !profile || !["admin","super_admin"].includes(profile.role) || profile.status !== "active") {
    await supabase.auth.signOut();
    location.href = "dashboard.html?error=admin_required";
    return null;
  }
  return { user, profile };
}

export async function signOut() {
  if (supabase) await supabase.auth.signOut();
  location.href = "index.html";
}
