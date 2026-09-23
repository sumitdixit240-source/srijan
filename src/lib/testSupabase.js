import { supabase } from "./supabase";

export async function testSupabaseConnection() {
  const { data, error } = await supabase
    .from("services")
    .select("id, name, status")
    .limit(5);

  if (error) {
    console.error("SUPABASE ERROR:", error);
    return {
      success: false,
      error: error.message,
    };
  }

  console.log("SUPABASE CONNECTED:", data);

  return {
    success: true,
    data,
  };
}