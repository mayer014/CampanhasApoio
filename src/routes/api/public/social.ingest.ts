import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifySocialSignature, unauthorized, badRequest, ok } from "@/lib/social-hmac.server";

const PostSchema = z.object({
  external_id: z.string().min(1).max(256),
  post_url: z.string().url().optional().nullable(),
  caption: z.string().max(8000).optional().nullable(),
  thumbnail_url: z.string().url().optional().nullable(),
  media_urls: z.array(z.string().url()).max(20).optional(),
  hashtags: z.array(z.string().max(140)).max(50).optional(),
  posted_at: z.string().datetime().optional().nullable(),
  likes: z.number().int().nonnegative().optional(),
  comments: z.number().int().nonnegative().optional(),
  views: z.number().int().nonnegative().optional(),
});

const Schema = z.object({
  profile_id: z.string().uuid(),
  profile_update: z
    .object({
      display_name: z.string().max(200).optional().nullable(),
      avatar_url: z.string().url().optional().nullable(),
      bio: z.string().max(2000).optional().nullable(),
      followers_count: z.number().int().nonnegative().optional().nullable(),
    })
    .optional(),
  posts: z.array(PostSchema).max(100).default([]),
});

export const Route = createFileRoute("/api/public/social/ingest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        if (!verifySocialSignature(raw, request.headers.get("x-social-signature"))) {
          return unauthorized();
        }
        let body: unknown;
        try { body = JSON.parse(raw || "{}"); } catch { return badRequest("invalid json"); }
        const parsed = Schema.safeParse(body);
        if (!parsed.success) return badRequest(parsed.error.message);

        const { data: profile, error: pErr } = await supabaseAdmin
          .from("social_profiles")
          .select("id, candidate_id, platform")
          .eq("id", parsed.data.profile_id)
          .maybeSingle();
        if (pErr) return badRequest(pErr.message);
        if (!profile) return badRequest("profile not found");

        if (parsed.data.profile_update) {
          const upd = parsed.data.profile_update;
          await supabaseAdmin
            .from("social_profiles")
            .update({
              display_name: upd.display_name ?? undefined,
              avatar_url: upd.avatar_url ?? undefined,
              bio: upd.bio ?? undefined,
              followers_count: upd.followers_count ?? undefined,
            })
            .eq("id", profile.id);
        }

        let inserted = 0;
        let updated = 0;
        for (const p of parsed.data.posts) {
          const row = {
            candidate_id: profile.candidate_id,
            profile_id: profile.id,
            platform: profile.platform,
            external_id: p.external_id,
            post_url: p.post_url ?? null,
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
          const { data: existing } = await supabaseAdmin
            .from("social_posts")
            .select("id")
            .eq("profile_id", profile.id)
            .eq("external_id", p.external_id)
            .maybeSingle();
          if (existing) {
            await supabaseAdmin.from("social_posts").update(row).eq("id", existing.id);
            updated++;
          } else {
            await supabaseAdmin.from("social_posts").insert(row);
            inserted++;
          }
        }

        return ok({ success: true, inserted, updated });
      },
    },
  },
});
