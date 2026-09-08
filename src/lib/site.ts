export const SITE_NAME = "EduVoq";
export const SITE_TAGLINE = "Connecting Educators";
export const SITE_TITLE = "EduVoq — Connecting Educators";
export const SITE_DESCRIPTION =
  "EduVoq is a professional network and resource hub for educators with an emphasis on school teachers. It aims to be a vibrant community of professionals involved in pre-school, primary and secondary education with a mission to provide educators an advertisement-free dedicated platform for sharing knowledge and connecting with each other.";

export function siteUrl(): string {
  const raw =
    process.env.AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

export function absoluteUrl(path: string): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${siteUrl()}${suffix}`;
}
