import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifica assinatura HMAC SHA256 enviada pelo worker.
 * Header esperado:
 *   X-Social-Signature: sha256=<hex>
 *   X-Social-Timestamp: <unix seconds>
 * Conteúdo assinado: `${rawBody}.${timestamp}`
 *
 * Tolera até 5 minutos de skew para evitar replay.
 */
export function verifySocialHmac(
  rawBody: string,
  signatureHeader: string | null,
  timestampHeader: string | null,
): { ok: boolean; reason?: string } {
  const secret = process.env.SOCIAL_HMAC_SECRET;
  if (!secret) return { ok: false, reason: "secret_not_configured" };
  if (!signatureHeader || !timestampHeader) return { ok: false, reason: "missing_headers" };

  const ts = Number(timestampHeader);
  if (!Number.isFinite(ts)) return { ok: false, reason: "bad_timestamp" };
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > 300) return { ok: false, reason: "stale" };

  const expected = createHmac("sha256", secret).update(`${rawBody}.${timestampHeader}`).digest("hex");
  const provided = signatureHeader.startsWith("sha256=") ? signatureHeader.slice(7) : signatureHeader;
  if (provided.length !== expected.length) return { ok: false, reason: "length_mismatch" };

  try {
    const a = Buffer.from(provided, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return { ok: false, reason: "decode_mismatch" };
    if (!timingSafeEqual(a, b)) return { ok: false, reason: "signature_invalid" };
    return { ok: true };
  } catch {
    return { ok: false, reason: "decode_error" };
  }
}

export async function readRawBody(request: Request): Promise<string> {
  return await request.text();
}
