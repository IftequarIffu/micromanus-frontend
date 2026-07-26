/** Canonical production origin (OG/Twitter absolute URLs, sitemap). */
export const DEFAULT_SITE_URL = "https://micromanus-frontend.vercel.app"

export const SITE_NAME = "micromanus"

export const DEFAULT_TITLE =
  "micromanus — Multi-model chat with your own API keys"

export const DEFAULT_DESCRIPTION =
  "Chat with GPT, Claude, and Gemini using your own API keys. micromanus streams answers with web citations, PDF tools, and platform credits—no provider markup."

export function siteUrl() {
  const fromEnv = import.meta.env.VITE_SITE_URL?.replace(/\/$/, "")
  if (fromEnv) return fromEnv
  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin
  }
  return DEFAULT_SITE_URL
}

export function absoluteUrl(path = "/") {
  const base = siteUrl()
  if (!path || path === "/") return `${base}/`
  return `${base}${path.startsWith("/") ? path : `/${path}`}`
}
