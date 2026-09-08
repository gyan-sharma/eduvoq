function hostnameFromAuthUrl(): string | null {
  const raw = process.env.AUTH_URL;
  if (!raw) return null;
  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
}

/** `.eduvoq.com` in prod so apex and www share the session cookie. */
export function sessionCookieDomain(): string | undefined {
  if (process.env.AUTH_COOKIE_DOMAIN) return process.env.AUTH_COOKIE_DOMAIN;
  const host = hostnameFromAuthUrl();
  if (host === "eduvoq.com" || host?.endsWith(".eduvoq.com")) {
    return ".eduvoq.com";
  }
  return undefined;
}

export function sessionCookieName(): string {
  const authUrl = process.env.AUTH_URL ?? "";
  return authUrl.startsWith("https://")
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";
}
