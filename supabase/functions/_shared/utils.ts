
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export async function validateUser(req: Request, supabaseClient: any) {
  const authHeader = req.headers.get("Authorization")!;
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabaseClient.auth.getUser(token);
  if (error || !user) throw new Error("Unauthorized");
  return user;
}

export async function checkClientAccess(supabaseClient: any, userId: string, clientId: string) {
  const { data, error } = await supabaseClient
    .from("candidate_profiles")
    .select("id")
    .eq("id", clientId)
    .single();
  
  // In this system, candidate_id is usually same as user_id or linked.
  // Based on existing code, candidate_profiles.id == auth.users.id
  if (error || !data || data.id !== userId) {
    // Check if user is admin
    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    
    if (!roleData) throw new Error("Forbidden: You do not have access to this client");
  }
}
