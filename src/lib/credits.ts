import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Helper: get a service-role supabase client
function getServiceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Manually burn a credit (decrement remaining_credits by amount). Returns true on success.
export async function burnCredits(userId: string, amount: number): Promise<boolean> {
  const supabase = getServiceClient();
  const { data: row } = await supabase
    .from("user_credits")
    .select("remaining_credits")
    .eq("user_id", userId)
    .single();

  const current = row?.remaining_credits ?? 0;
  if (current < amount) return false;

  const { error } = await supabase
    .from("user_credits")
    .update({ remaining_credits: current - amount, updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  return !error;
}

// Manually add credits (increment remaining_credits by amount). Returns true on success.
export async function addCredits(userId: string, amount: number): Promise<boolean> {
  const supabase = getServiceClient();
  const { data: row } = await supabase
    .from("user_credits")
    .select("remaining_credits")
    .eq("user_id", userId)
    .single();

  if (row) {
    const { error } = await supabase
      .from("user_credits")
      .update({ remaining_credits: (row.remaining_credits ?? 0) + amount, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    return !error;
  } else {
    const { error } = await supabase.from("user_credits").insert({
      user_id: userId,
      remaining_credits: amount,
      total_purchased: 0,
    });
    return !error;
  }
}

// Get remaining credits for a user
export async function getRemainingCredits(userId: string): Promise<number> {
  const supabase = getServiceClient();
  const { data: row } = await supabase
    .from("user_credits")
    .select("remaining_credits")
    .eq("user_id", userId)
    .single();
  return row?.remaining_credits ?? 0;
}
