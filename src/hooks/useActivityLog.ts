import { supabase } from "@/integrations/supabase/client";

export async function logActivity(action: string, metadata?: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  
  await supabase.from("auth_activity_log").insert([{
    user_id: session.user.id,
    action,
    metadata: metadata || {},
  }]);
}
