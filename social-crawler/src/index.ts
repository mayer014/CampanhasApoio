import { env } from "./env.js";
import { fetchNextJob, reportIngest } from "./queue.js";
import { crawlProfile } from "./crawler.js";
import { jitter } from "./antiBlock.js";
import { shutdown } from "./browser.js";

async function tick(): Promise<"job" | "idle"> {
  const next = await fetchNextJob();
  if (!next) return "idle";

  const { job, profile } = next;
  console.log(`[worker] ${job.id} ${job.job_type} attempt=${job.attempts} profile=${profile?.username}`);

  if (job.job_type !== "crawl_profile" || !profile) {
    await reportIngest({
      job_id: job.id,
      profile_id: job.profile_id,
      ok: false,
      error: "unsupported job_type (Fase 1: apenas crawl_profile)",
    });
    return "job";
  }

  try {
    const result = await crawlProfile(profile.username);
    const ok = await reportIngest({
      job_id: job.id,
      profile_id: job.profile_id,
      ok: true,
      profile_update: {
        display_name: result.display_name,
        avatar_url: result.avatar_url,
        bio: result.bio,
        followers_count: result.followers_count,
      },
      posts: result.posts,
    });
    if (!ok) console.error("[worker] ingest report failed");
  } catch (e) {
    const err = (e as Error).message || "crawler error";
    console.error(`[worker] crawl failed ${profile.username}: ${err}`);
    await reportIngest({
      job_id: job.id,
      profile_id: job.profile_id,
      ok: false,
      error: err.slice(0, 480),
    });
  }
  return "job";
}

async function main() {
  console.log(`[worker] starting ${env.WORKER_ID} → ${env.API_BASE_URL}`);
  let consecutiveIdle = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const r = await tick();
      if (r === "idle") {
        consecutiveIdle++;
        const wait = Math.min(env.IDLE_BACKOFF_MS * Math.max(1, consecutiveIdle), 300_000);
        await jitter(wait * 0.8, wait);
      } else {
        consecutiveIdle = 0;
        await jitter(env.POLL_INTERVAL_MS * 0.7, env.POLL_INTERVAL_MS * 1.3);
      }
    } catch (e) {
      console.error("[worker] loop error", (e as Error).message);
      await jitter(10_000, 20_000);
    }
  }
}

main().catch(async (e) => {
  console.error("[worker] fatal", e);
  await shutdown();
  process.exit(1);
});
