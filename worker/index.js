// =====================================================================
// social-crawler worker v2 (Supabase direto)
// ---------------------------------------------------------------------
// Substitui a versão antiga que falava HTTP com /api/public/social/*.
// Agora usa @supabase/supabase-js com service_role.
//
// Envs obrigatórias:
//   SUPABASE_URL                 ex: https://pfppmkqsdqawvykkgafe.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY    (Dashboard Supabase → Settings → API)
//
// Envs opcionais:
//   WORKER_ID                    default: crawler-<hostname>
//   POLL_INTERVAL_MS             default: 15000
//   HEARTBEAT_INTERVAL_MS        default: 30000
//   MAX_POSTS_PER_PROFILE        default: 12
//   HEADFUL                      default: false  ("true" abre browser visível)
// =====================================================================

const os = require("os");
const { chromium } = require("playwright");
const { createClient } = require("@supabase/supabase-js");

// ---------- Config ----------
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WORKER_ID = process.env.WORKER_ID || `crawler-${os.hostname()}`;
const POLL_MS = parseInt(process.env.POLL_INTERVAL_MS || "15000", 10);
const HEARTBEAT_MS = parseInt(process.env.HEARTBEAT_INTERVAL_MS || "30000", 10);
const MAX_POSTS = parseInt(process.env.MAX_POSTS_PER_PROFILE || "12", 10);
const HEADFUL = process.env.HEADFUL === "true";

if (!SUPABASE_URL) { console.error("FATAL: SUPABASE_URL não definido"); process.exit(1); }
if (!SERVICE_ROLE) { console.error("FATAL: SUPABASE_SERVICE_ROLE_KEY não definido"); process.exit(1); }

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let jobsProcessed = 0;
let lastError = "";

// ---------- Supabase helpers ----------
async function heartbeat(status = "online") {
  try {
    const { error } = await sb.rpc("social_worker_heartbeat", {
      _worker_id: WORKER_ID,
      _status: status,
      _jobs_processed: jobsProcessed,
      _last_error: lastError || null,
      _meta: { headful: HEADFUL, node: process.version, pid: process.pid },
    });
    if (error) throw error;
  } catch (e) {
    console.error("[heartbeat] erro:", e.message);
  }
}

async function checkBreaker() {
  const { data } = await sb
    .from("social_system_state")
    .select("breaker_open, breaker_reason, breaker_reset_at")
    .eq("id", 1)
    .maybeSingle();
  return data || { breaker_open: false };
}

async function claimJob() {
  const { data, error } = await sb.rpc("claim_next_social_job", { _worker_id: WORKER_ID });
  if (error) throw error;
  const job = Array.isArray(data) && data.length ? data[0] : null;
  if (!job) return null;
  let profile = null;
  if (job.profile_id) {
    const { data: p } = await sb
      .from("social_profiles")
      .select("id, candidate_id, username, platform, profile_type, last_checked_at, followers_count")
      .eq("id", job.profile_id)
      .maybeSingle();
    profile = p;
  }
  return { job, profile };
}

async function completeJob(jobId, ok, error) {
  const { error: e } = await sb.rpc("complete_social_job", {
    _job_id: jobId,
    _ok: ok,
    _error: error || "",
  });
  if (e) console.error("[complete] erro:", e.message);
}

async function sendLog(level, kind, message, extra = {}) {
  try {
    await sb.from("social_worker_logs").insert({
      worker_id: WORKER_ID,
      level,
      kind,
      message: String(message).slice(0, 1000),
      job_id: extra.job_id || null,
      profile_id: extra.profile_id || null,
      context: extra.context || {},
    });
  } catch (e) {
    console.error("[log] falhou:", e.message);
  }
}

async function ingestResult({ job, profile, profile_update, posts }) {
  // 1) atualiza social_profiles
  let profileRow = null;
  if (profile?.id) {
    const upd = { last_checked_at: new Date().toISOString() };
    if (profile_update) {
      if (profile_update.display_name !== undefined) upd.display_name = profile_update.display_name;
      if (profile_update.avatar_url !== undefined) upd.avatar_url = profile_update.avatar_url;
      if (profile_update.bio !== undefined) upd.bio = profile_update.bio;
      if (profile_update.followers_count !== undefined) upd.followers_count = profile_update.followers_count;
    }
    const { data: p } = await sb
      .from("social_profiles")
      .update(upd)
      .eq("id", profile.id)
      .select("id, candidate_id, profile_type")
      .maybeSingle();
    profileRow = p || null;
  }

  // 2) upsert social_posts
  let inserted = 0;
  let updated = 0;
  const postIds = [];

  if (posts?.length && profileRow) {
    for (const p of posts) {
      const { data: existing } = await sb
        .from("social_posts")
        .select("id")
        .eq("profile_id", profileRow.id)
        .eq("external_id", p.external_id)
        .maybeSingle();

      const row = {
        candidate_id: profileRow.candidate_id,
        profile_id: profileRow.id,
        platform: "instagram",
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
        await sb.from("social_posts").update(row).eq("id", existing.id);
        postIds.push(existing.id);
        updated++;
      } else {
        const { data: ins } = await sb
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

    // 3) snapshots + alertas heurísticos
    for (const id of postIds) {
      await sb.rpc("record_social_snapshot", { _post_id: id });
    }
  }

  return { inserted, updated };
}

// ---------- Playwright: scrape Instagram ----------
let browser = null;
async function getBrowser() {
  if (browser && browser.isConnected()) return browser;
  browser = await chromium.launch({
    headless: !HEADFUL,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  return browser;
}

function parseCount(s) {
  if (s == null) return null;
  const t = String(s).trim().toLowerCase().replace(/\./g, "").replace(",", ".");
  const m = t.match(/^([\d.]+)\s*(k|m|mi|mil|b)?/);
  if (!m) return null;
  let n = parseFloat(m[1]);
  if (!isFinite(n)) return null;
  const suf = m[2];
  if (suf === "k" || suf === "mil") n *= 1_000;
  else if (suf === "m" || suf === "mi") n *= 1_000_000;
  else if (suf === "b") n *= 1_000_000_000;
  return Math.round(n);
}

function extractHashtags(s) {
  if (!s) return [];
  return Array.from(new Set((s.match(/#[\p{L}0-9_]+/gu) || []).map((x) => x.toLowerCase()))).slice(0, 50);
}
function extractMentions(s) {
  if (!s) return [];
  return Array.from(new Set((s.match(/@[\p{L}0-9_.]+/gu) || []).map((x) => x.toLowerCase()))).slice(0, 50);
}

async function scrapeInstagramProfile(username) {
  const br = await getBrowser();
  const context = await br.newContext({
    userAgent:
      "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36",
    viewport: { width: 412, height: 915 },
    locale: "pt-BR",
  });
  const page = await context.newPage();
  const url = `https://www.instagram.com/${encodeURIComponent(username)}/`;

  try {
    const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    if (resp && resp.status() === 404) {
      throw Object.assign(new Error("profile not found"), { kind: "parser_failure" });
    }

    const html = await page.content();
    if (/login|entrar/i.test(await page.title()) && /loginForm|password/i.test(html)) {
      throw Object.assign(new Error("login wall"), { kind: "login_wall" });
    }
    if (/checkpoint|challenge|captcha/i.test(html)) {
      throw Object.assign(new Error("captcha/challenge"), { kind: "captcha" });
    }
    if (resp && (resp.status() === 429 || /rate.?limit/i.test(html))) {
      throw Object.assign(new Error("rate limited"), { kind: "rate_limit" });
    }

    const meta = await page.evaluate(() => {
      const get = (sel, attr = "content") => document.querySelector(sel)?.getAttribute(attr) || null;
      return {
        title: get('meta[property="og:title"]'),
        description: get('meta[property="og:description"]'),
        image: get('meta[property="og:image"]'),
      };
    });

    let followers = null;
    if (meta.description) {
      const m = meta.description.match(/([\d.,]+[KMmilB]?)\s+(Followers|Seguidores)/i);
      if (m) followers = parseCount(m[1]);
    }
    const display_name = meta.title ? meta.title.replace(/\s*\(@.*\).*$/, "").trim() : null;

    await page.waitForTimeout(2500);
    const posts = await page.evaluate((max) => {
      const seen = new Set();
      const out = [];
      const anchors = document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]');
      for (const a of anchors) {
        const href = a.getAttribute("href") || "";
        const m = href.match(/\/(p|reel)\/([^/?#]+)/);
        if (!m) continue;
        const id = m[2];
        if (seen.has(id)) continue;
        seen.add(id);
        const img = a.querySelector("img");
        out.push({
          external_id: id,
          post_type: m[1] === "reel" ? "reel" : "feed",
          thumbnail_url: img?.getAttribute("src") || null,
          caption: img?.getAttribute("alt") || null,
        });
        if (out.length >= max) break;
      }
      return out;
    }, MAX_POSTS);

    const normalized = posts.map((p) => ({
      external_id: p.external_id,
      post_type: p.post_type,
      caption: p.caption,
      hashtags: extractHashtags(p.caption),
      mentions: extractMentions(p.caption),
      media_urls: p.thumbnail_url ? [p.thumbnail_url] : [],
      thumbnail_url: p.thumbnail_url,
      posted_at: null,
      likes: null,
      comments: null,
      views: null,
    }));

    return {
      profile_update: {
        display_name,
        avatar_url: meta.image,
        bio: meta.description,
        followers_count: followers,
      },
      posts: normalized,
    };
  } finally {
    await context.close().catch(() => {});
  }
}

// ---------- Processar 1 job ----------
async function processJob(job, profile) {
  const jobCtx = { job_id: job.id, profile_id: job.profile_id };
  console.log(`[job ${job.id}] type=${job.job_type} profile=@${profile?.username ?? "—"}`);

  if (job.job_type !== "crawl_profile" || !profile?.username) {
    await completeJob(job.id, false, `unsupported job_type=${job.job_type}`);
    return;
  }
  if ((profile.platform || "instagram") !== "instagram") {
    await completeJob(job.id, false, `platform not supported: ${profile.platform}`);
    return;
  }

  try {
    const result = await scrapeInstagramProfile(profile.username);
    const { inserted, updated } = await ingestResult({
      job,
      profile,
      profile_update: result.profile_update,
      posts: result.posts,
    });
    await completeJob(job.id, true, null);
    jobsProcessed++;
    lastError = "";
    console.log(`[job ${job.id}] OK — posts: ${result.posts.length} (novos ${inserted}, atualizados ${updated})`);
  } catch (err) {
    lastError = err.message;
    const kind = err.kind || "parser_failure";
    const severity = kind === "login_wall" || kind === "captcha" || kind === "rate_limit" ? "critical" : "error";
    console.error(`[job ${job.id}] FAIL (${kind}):`, err.message);
    await sendLog(severity, kind, err.message, jobCtx);
    await completeJob(job.id, false, err.message);
  }
}

// ---------- Loop principal ----------
async function mainLoop() {
  console.log(`social-crawler v2 iniciado — worker=${WORKER_ID} supabase=${SUPABASE_URL}`);

  setInterval(() => { heartbeat("online").catch(() => {}); }, HEARTBEAT_MS);
  await heartbeat("online");

  while (true) {
    try {
      const breaker = await checkBreaker();
      if (breaker.breaker_open) {
        console.log(`[breaker] aberto: ${breaker.breaker_reason || ""} — aguardando ${POLL_MS * 4}ms`);
        await sleep(POLL_MS * 4);
        continue;
      }

      const claim = await claimJob();
      if (!claim) {
        await sleep(POLL_MS);
        continue;
      }
      await processJob(claim.job, claim.profile);
    } catch (err) {
      lastError = err.message;
      console.error("[loop] erro:", err.message);
      await sendLog("error", "network_error", err.message).catch(() => {});
      await sleep(POLL_MS);
    }
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------- Shutdown ----------
process.on("SIGTERM", async () => {
  console.log("SIGTERM recebido, encerrando...");
  await heartbeat("offline").catch(() => {});
  if (browser) await browser.close().catch(() => {});
  process.exit(0);
});

mainLoop().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
