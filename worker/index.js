// =====================================================================
// social-crawler worker v2
// ---------------------------------------------------------------------
// Fala DIRETO com o Supabase usando service_role. Não depende mais do
// site publicado, não usa HMAC, não chama /api/public/social/*.
//
// Envs obrigatórias:
//   SUPABASE_URL                 ex: https://pfppmkqsdqawvykkgafe.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY    (pegue no dashboard Supabase, NUNCA exponha)
//   WORKER_ID                    ex: worker-1
//
// Envs opcionais:
//   POLL_INTERVAL_MS             default 5000   (intervalo quando não há job)
//   HEARTBEAT_INTERVAL_MS        default 30000
// =====================================================================

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WORKER_ID = process.env.WORKER_ID || `worker-${Math.random().toString(36).slice(2, 8)}`;
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 5000);
const HEARTBEAT_INTERVAL_MS = Number(process.env.HEARTBEAT_INTERVAL_MS || 30000);

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("[fatal] SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let jobsProcessed = 0;
let lastError = null;
let running = true;

// ---------- heartbeat ----------
async function heartbeat(status = "online") {
  const { error } = await sb.rpc("social_worker_heartbeat", {
    _worker_id: WORKER_ID,
    _status: status,
    _jobs_processed: jobsProcessed,
    _last_error: lastError,
    _meta: { node: process.version, pid: process.pid },
  });
  if (error) console.error("[heartbeat] erro:", error.message);
}

// ---------- log helper ----------
async function logEvent(level, kind, message, ctx = {}) {
  await sb.from("social_worker_logs").insert({
    worker_id: WORKER_ID,
    level,
    kind,
    message,
    context: ctx,
    job_id: ctx.job_id ?? null,
    profile_id: ctx.profile_id ?? null,
  });
}

// ---------- carregar profile do job ----------
async function loadProfile(profileId) {
  if (!profileId) return null;
  const { data, error } = await sb
    .from("social_profiles")
    .select("id, username, platform, profile_type, last_checked_at, followers_count")
    .eq("id", profileId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// =====================================================================
// processJob — substitua o corpo desta função pela sua lógica REAL de
// scraping (a que já está no seu worker atual). O contrato é:
//   - recebe { job, profile }
//   - faz o trabalho (Instagram, etc.)
//   - opcionalmente grava em social_posts via sb.from('social_posts').upsert(...)
//   - se quiser registrar snapshot de métricas, chama sb.rpc('record_social_snapshot', { _post_id })
//   - se der erro, throw — o loop cuida do complete_social_job(ok=false)
// =====================================================================
async function processJob({ job, profile }) {
  console.log(`[job ${job.id}] type=${job.job_type} profile=@${profile?.username ?? "—"}`);

  // TODO: cole aqui a lógica do worker atual.
  // Exemplo mínimo só pra não quebrar o fluxo:
  if (!profile) throw new Error("job sem profile_id");

  // Simulação: marca como "checado agora"
  // (REMOVA quando colocar a lógica real)
  await new Promise((r) => setTimeout(r, 500));
}

// ---------- loop principal ----------
async function loop() {
  while (running) {
    try {
      const { data, error } = await sb.rpc("claim_next_social_job", { _worker_id: WORKER_ID });
      if (error) {
        lastError = error.message;
        console.error("[claim] erro:", error.message);
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      const job = Array.isArray(data) && data.length ? data[0] : null;
      if (!job) {
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      let profile = null;
      try {
        profile = await loadProfile(job.profile_id);
        await processJob({ job, profile });
        await sb.rpc("complete_social_job", { _job_id: job.id, _ok: true, _error: null });
        jobsProcessed += 1;
        lastError = null;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        lastError = msg;
        console.error(`[job ${job.id}] falhou:`, msg);
        await sb.rpc("complete_social_job", { _job_id: job.id, _ok: false, _error: msg });
        await logEvent("error", "job_error", msg, { job_id: job.id, profile_id: job.profile_id });
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      console.error("[loop] crash:", lastError);
      await sleep(POLL_INTERVAL_MS);
    }
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------- shutdown gracioso ----------
async function shutdown(signal) {
  console.log(`[${signal}] desligando ${WORKER_ID}…`);
  running = false;
  await heartbeat("offline").catch(() => {});
  process.exit(0);
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// ---------- start ----------
console.log(`[worker] iniciando ${WORKER_ID} → ${SUPABASE_URL}`);
await heartbeat("online");
setInterval(() => heartbeat("online").catch(() => {}), HEARTBEAT_INTERVAL_MS);
loop();
