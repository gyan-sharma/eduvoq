export function getTurnstileSiteKey() {
  return (
    process.env.TURNSTILE_SITE_KEY ||
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
    ""
  );
}

export function getTurnstileSecretKey() {
  return process.env.TURNSTILE_SECRET_KEY || "";
}

export async function verifyTurnstileToken(token: string) {
  const secret = getTurnstileSecretKey();
  if (!secret) {
    return token.length > 0;
  }

  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
    },
  );

  if (!response.ok) {
    return false;
  }

  const payload = (await response.json()) as { success?: boolean };
  return payload.success === true;
}
