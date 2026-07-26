import { useEffect } from "react"
import { useLocation } from "react-router"
import {
  absoluteUrl,
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
  SITE_NAME,
} from "@/lib/site"

type RouteMeta = {
  title: string
  description?: string
}

function metaForPath(pathname: string): RouteMeta {
  if (pathname === "/login") {
    return {
      title: "Sign in to micromanus — Multi-model BYOK chat",
      description: DEFAULT_DESCRIPTION,
    }
  }

  if (pathname === "/settings/keys") {
    return { title: "API keys — micromanus" }
  }

  if (pathname === "/credits") {
    return { title: "Credits — micromanus" }
  }

  if (pathname.startsWith("/chat/")) {
    return { title: "Chat — micromanus" }
  }

  if (pathname === "/new" || pathname === "/") {
    return { title: "New chat — micromanus" }
  }

  return {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  }
}

function upsertMeta(
  attr: "name" | "property",
  key: string,
  content: string
) {
  const selector = `meta[${attr}="${key}"]`
  let el = document.head.querySelector<HTMLMetaElement>(selector)
  if (!el) {
    el = document.createElement("meta")
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.content = content
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement("link")
    el.rel = rel
    document.head.appendChild(el)
  }
  el.href = href
}

/**
 * Per-route title + self-referencing canonical (frontendchecklist:
 * meta-title, title-unique, canonical-url).
 *
 * Keep robots as index,follow (from index.html). Meta noindex / robots.txt
 * Disallow fail Lighthouse "Page is blocked from indexing" on app routes.
 */
export function DocumentMeta() {
  const { pathname } = useLocation()

  useEffect(() => {
    const meta = metaForPath(pathname)
    const description = meta.description ?? DEFAULT_DESCRIPTION
    // Self-referencing canonical on the current origin (not a hard-coded host).
    const canonical = absoluteUrl(pathname)

    document.title = meta.title

    upsertMeta("name", "description", description)
    upsertMeta("name", "robots", "index,follow")
    upsertMeta("property", "og:title", meta.title)
    upsertMeta("property", "og:description", description)
    upsertMeta("property", "og:url", canonical)
    upsertMeta("property", "og:image", absoluteUrl("/og-image.png"))
    upsertMeta("property", "og:site_name", SITE_NAME)
    upsertMeta("name", "twitter:title", meta.title)
    upsertMeta("name", "twitter:description", description)
    upsertMeta("name", "twitter:image", absoluteUrl("/og-image.png"))
    upsertLink("canonical", canonical)
  }, [pathname])

  return null
}
