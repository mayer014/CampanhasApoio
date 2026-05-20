import { createHmac } from "node:crypto";
import { env } from "./env.js";

function sign(rawBody: string): { sig: string; ts: string } {
  const ts = Math.floor(Date.now() / 1000).toString();
  const sig = createHmac("sha256", env.SOCIAL_HMAC_SECRET)
    .update(`${rawBody}.${ts}`)
    .digest("hex");
  return { sig: `sha256=${sig}`, ts };
}

export type Job = {
  id: string;
  job_type: "crawl_profile" | "crawl_post";
  candidate_id: string;
  profile_id: string | null;
  post_id: string | null;
  payload: Record<string, unknown>;
  attempts: number;
};

export type ProfileMeta = {
  id: string;
  username: string;
  platform: "instagram";
  profile_type: "own_profile" | "competitor" | "portal" | "influencer";
  last_checked_at: string | null;
  followers_count: number | null;
};

export async function fetchNextJob(): Promise<{ job: Job; profile: ProfileMeta | null } | null> {
  const raw = "{}";
  const { sig, ts } = sign(raw);
  const res = await fetch(`${env.API_BASE_URL}/api/public/social/next-job`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Social-Signature": sig,
      "X-Social-Timestamp": ts,
      "X-Worker-Id": env.WORKER_ID,
    },
    body: raw,
  });
  if (!res.ok) {
    console.error(`[queue] next-job ${res.status}: ${await res.text()}`);
    return null;
  }
  const data = (await res.json()) as { job: Job | null; profile: ProfileMeta | null };
  if (!data.job) return null;
  return { job: data.job, profile: data.profile };
}

export async function reportIngest(body: Record<string, unknown>): Promise<boolean> {
  const raw = JSON.stringify(body);
  const { sig, ts } = sign(raw);
  const res = await fetch(`${env.API_BASE_URL}/api/public/social/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Social-Signature": sig,
      "X-Social-Timestamp": ts,
      "X-Worker-Id": env.WORKER_ID,
    },
    body: raw,
  });
  if (!res.ok) {
    console.error(`[report] ingest ${res.status}: ${await res.text()}`);
    return false;
  }
  return true;
}
