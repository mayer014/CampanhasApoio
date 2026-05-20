import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifySocialHmac, detectAlertsForProfile } from "@/lib/social.server";

/**
 * POST /api/public/social/ingest
 * Body (json):
 *  {
 *    job_id: uuid,
 *    profile_id: uuid,
 *    ok: boolean,
 *    error?: string,
 *    profile_update?: { display_name?, avatar_url?, bio?, followers_count? },
 *    posts?: [{
 *       external_id, post_type, caption, hashtags, mentions, media_urls,
 *       thumbnail_url, posted_at, likes, comments, views
 *    }, ...]
 *  }
 *
 *  Incremental: crawler should stop scrolling when it hits an external_id
 *  that already exists for the profile. We dedupe via (profile_id, external_id).
 */
export const Route = createFileRoute("/api/public/social/ingest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const sig = request.headers.get("x-social-signature");
        const ts = request.headers.get("x-social-timestamp");

        const v = verifySocialHmac(raw, sig, ts);
        if (!v.ok) {
          return new Response(JSON.stringify({ error: v.reason }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        let body: any;
        try {
          body = JSON.parse(raw);
        } catch {
          return new Response(JSON.stringify({ error: "bad json" }), { status: 400 });
        }

        const jobId = body.job_id as string | undefined;
        const profileId = body.profile_id as string | undefined;
        if (!jobId || !profileId) {
          return new Response(JSON.stringify({ error: "missing job_id/profile_id" }), {
            status: 400,
          });
        }

        const { data: prof } = await supabaseAdmin
          .from("social_profiles")
          .select("id, candidate_id, profile_type")
          .eq("id", profileId)
          .maybeSingle();
        if (!prof) {
          await supabaseAdmin.rpc("complete_social_job", {
            _job_id: jobId,
            _ok: false,
            _error: "profile not found",
          });
          return new Response(JSON.stringify({ error: "profile not found" }), { status: 404 });
        }

        if (body.ok === false) {
          await supabaseAdmin.rpc("complete_social_job", {
            _job_id: jobId,
            _ok: false,
            _error: String(body.error || "crawler failure").slice(0, 500),
          });
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }

        // Update profile metadata
        if (body.profile_update && typeof body.profile_update === "object") {
          const u = body.profile_update;
          await supabaseAdmin
            .from("social_profiles")
            .update({
              display_name: u.display_name ?? undefined,
              avatar_url: u.avatar_url ?? undefined,
              bio: u.bio ?? undefined,
              followers_count: Number.isFinite(u.followers_count)
                ? u.followers_count
                : undefined,
            })
            .eq("id", profileId);
        }

        // Upsert posts + snapshots
        const posts: any[] = Array.isArray(body.posts) ? body.posts : [];
        let inserted = 0;
        let snapshots = 0;
        for (const p of posts) {
          if (!p?.external_id) continue;
          const postedAt = p.posted_at ? new Date(p.posted_at).toISOString() : new Date().toISOString();
          const { data: up, error: upErr } = await supabaseAdmin
            .from("social_posts")
            .upsert(
              {
                candidate_id: prof.candidate_id,
                profile_id: profileId,
                external_id: String(p.external_id),
                post_type: ["feed", "reel", "carousel", "story"].includes(p.post_type)
                  ? p.post_type
                  : "feed",
                caption: p.caption ?? null,
                hashtags: Array.isArray(p.hashtags) ? p.hashtags.slice(0, 50) : [],
                mentions: Array.isArray(p.mentions) ? p.mentions.slice(0, 50) : [],
                media_urls: Array.isArray(p.media_urls) ? p.media_urls.slice(0, 10) : [],
                thumbnail_url: p.thumbnail_url ?? null,
                posted_at: postedAt,
                last_seen_at: new Date().toISOString(),
              },
              { onConflict: "profile_id,external_id" },
            )
            .select("id")
            .single();
          if (upErr) {
            console.error("[social.ingest] upsert post", upErr.message);
            continue;
          }
          inserted++;

          if (Number.isFinite(p.likes) || Number.isFinite(p.comments) || Number.isFinite(p.views)) {
            await supabaseAdmin.from("social_post_snapshots").insert({
              candidate_id: prof.candidate_id,
              post_id: up.id,
              likes: Number.isFinite(p.likes) ? p.likes : null,
              comments: Number.isFinite(p.comments) ? p.comments : null,
              views: Number.isFinite(p.views) ? p.views : null,
            });
            snapshots++;
          }
        }

        // Detect alerts (heurística leve)
        try {
          await detectAlertsForProfile(
            supabaseAdmin,
            profileId,
            prof.candidate_id,
            prof.profile_type,
          );
        } catch (e: any) {
          console.error("[social.ingest] alerts error", e?.message);
        }

        await supabaseAdmin.rpc("complete_social_job", {
          _job_id: jobId,
          _ok: true,
          _error: "",
        });

        return new Response(
          JSON.stringify({ ok: true, inserted, snapshots }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
