import { createHmac, timingSafeEqual } from "crypto";

/**
 * Verifies HMAC-SHA256 signature for worker→backend requests.
 * Worker sends header `x-social-signature: sha256=<hex>` over the raw body.
 */
export function verifySocialSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.SOCIAL_HMAC_SECRET;
  if (!secret) return false;
  if (!signatureHeader) return false;

  const provided = signatureHeader.startsWith("sha256=")
    ? signatureHeader.slice(7)
    : signatureHeader;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");

  try {
    const a = Buffer.from(provided, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function unauthorized(message = "invalid signature") {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}

export function badRequest(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { "content-type": "application/json" },
  });
}

export function ok(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
