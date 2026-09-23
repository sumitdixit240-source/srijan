import { supabase } from "./supabase";

export async function signUpUser({
  email,
  password,
  fullName,
  phone,
  businessName,
}) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        phone: phone,
        business_name: businessName,
      },
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function loginUser(email, password) {
  const { data, error } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });

  if (error) {
    throw error;
  }

  return data;
}

export async function logoutUser() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}

export async function getCurrentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}