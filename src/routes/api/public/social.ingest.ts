import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifySocialHmac } from "@/lib/social-hmac.server";

const PostSchema = z.object({
  external_id: z.string().min(1).max(80),
  post_type: z.enum(["feed", "reel", "carousel", "story"]).default("feed"),
  caption: z.string().nullable().optional(),
  hashtags: z.array(z.string()).default([]),
  mentions: z.array(z.string()).default([]).optional(),
  media_urls: z.array(z.string()).default([]),
  thumbnail_url: z.string().nullable().optional(),
  posted_at: z.string().nullable().optional(),
  likes: z.number().int().nullable().optional(),
  comments: z.number().int().nullable().optional(),
  views: z.number().int().nullable().optional(),
});

const Body = z.object({
  job_id: z.string().uuid(),
  profile_id: z.string().uuid().nullable(),
  ok: z.boolean(),
  error: z.string().max(500).optional(),
  profile_update: z
    .object({
      display_name: z.string().nullable().optional(),
      avatar_url: z.string().nullable().optional(),
      bio: z.string().nullable().optional(),
      followers_count: z.number().int().nullable().optional(),
    })
    .optional(),
  posts: z.array(PostSchema).optional(),
});

export const Route = createFileRoute("/api/public/social/ingest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const v = verifySocialHmac(
          raw,
          request.headers.get("x-social-signature"),
          request.headers.get("x-social-timestamp"),
        );
        if (!v.ok) return new Response(JSON.stringify({ error: "unauthorized", reason: v.reason }), { status: 401, headers: { "content-type": "application/json" } });

        let body;
        try { body = Body.parse(JSON.parse(raw)); }
        catch (e) { return new Response(JSON.stringify({ error: "bad_request", detail: (e as Error).message }), { status: 400, headers: { "content-type": "application/json" } }); }

        // Atualiza perfil (metadados públicos)
        let profileRow: { id: string; candidate_id: string; profile_type: string } | null = null;
        if (body.profile_id) {
          const upd: Record<string, unknown> = { last_checked_at: new Date().toISOString() };
          if (body.profile_update) {
            if (body.profile_update.display_name !== undefined) upd.display_name = body.profile_update.display_name;
            if (body.profile_update.avatar_url !== undefined) upd.avatar_url = body.profile_update.avatar_url;
            if (body.profile_update.bio !== undefined) upd.bio = body.profile_update.bio;
            if (body.profile_update.followers_count !== undefined) upd.followers_count = body.profile_update.followers_count;
          }
          const { data: p } = await supabaseAdmin
            .from("social_profiles")
            .update(upd)
            .eq("id", body.profile_id)
            .select("id, candidate_id, profile_type")
            .maybeSingle();
          profileRow = p as typeof profileRow;
        }

        let inserted = 0;
        let updated = 0;
        const postIds: string[] = [];

        if (body.posts?.length && profileRow) {
          for (const p of body.posts) {
            const { data: existing } = await supabaseAdmin
              .from("social_posts")
              .select("id")
              .eq("profile_id", profileRow.id)
              .eq("external_id", p.external_id)
              .maybeSingle();

            const row = {
              candidate_id: profileRow.candidate_id,
              profile_id: profileRow.id,
              platform: "instagram" as const,
              external_id: p.external_id,
              post_url: `https://www.instagram.com/${p.post_type === "reel" ? "reel" : "p"}/${p.external_id}/`,
              caption: p.caption ?? null,
              thumbnail_url: p.thumbnail_url ?? null,
              media_urls: p.media_urls ?? [],
              hashtags: p.hashtags ?? [],
              posted_at: p.posted_at ?? null,
              likes: p.likes ?? 0,
              comments: p.comments ?? 0,
              views: p.views ?? 0,
              last_seen_at: new Date().toISOString(),
            };

            if (existing) {
              await supabaseAdmin.from("social_posts").update(row).eq("id", existing.id);
              postIds.push(existing.id);
              updated++;
            } else {
              const { data: ins } = await supabaseAdmin
                .from("social_posts")
                .insert(row)
                .select("id")
                .single();
              if (ins) {
                postIds.push(ins.id);
                inserted++;
              }
            }
          }

          // dispara snapshots + alertas heurísticos
          for (const id of postIds) {
            await supabaseAdmin.rpc("record_social_snapshot", { _post_id: id });
          }
        }

        // Finaliza job
        await supabaseAdmin.rpc("complete_social_job", {
          _job_id: body.job_id,
          _ok: body.ok,
          _error: body.error ?? null,
        });

        return Response.json({ ok: true, inserted, updated });
      },
    },
  },
});
