import { createClient } from "@/lib/supabase/server";

export async function bancoPronto(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("profiles").select("id").limit(1);
    return !error;
  } catch {
    return false;
  }
}

export async function usuarioAtual() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data?.user ?? null;
}
