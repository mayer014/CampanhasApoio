import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { userClientFromToken, userIdFromToken } from "./whatsapp.server";

export const adminListInstances = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ access_token: z.string().min(10) }).parse(input)
  )
  .handler(async ({ data }) => {
    const callerId = await userIdFromToken(data.access_token);
    const supabaseUser = await userClientFromToken(data.access_token);

    const { data: roleRow } = await supabaseUser
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) throw new Error("Forbidden");

    const { data: list } = await supabaseUser
      .from("whatsapp_instances")
      .select(
        "id, candidate_id, name, phone_number, status, last_connected_at, daily_cap"
      )
      .order("created_at", { ascending: false });

    const ids = (list || []).map((i) => i.candidate_id);
    const { data: profs } = ids.length
      ? await supabaseUser
          .from("candidate_profiles")
          .select("id, full_name, email")
          .in("id", ids)
      : { data: [] as any[] };

    const profMap = new Map((profs || []).map((p: any) => [p.id, p]));

    const sinceMidnight = new Date();
    sinceMidnight.setHours(0, 0, 0, 0);

    const todaysSent = ids.length
      ? await supabaseUser
          .from("whatsapp_send_log")
          .select("candidate_id")
          .in("candidate_id", ids)
          .eq("status", "sent")
          .gte("created_at", sinceMidnight.toISOString())
      : { data: [] as any[] };

    const sentCounts = new Map<string, number>();
    for (const row of todaysSent.data || []) {
      sentCounts.set(row.candidate_id, (sentCounts.get(row.candidate_id) || 0) + 1);
    }

    return (list || []).map((i) => ({
      ...i,
      candidate: profMap.get(i.candidate_id) || null,
      sent_today: sentCounts.get(i.candidate_id) || 0,
    }));
  });