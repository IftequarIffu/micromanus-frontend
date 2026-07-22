import path from "path"
import type { ProxyOptions } from "vite"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const BACKEND = "http://localhost:4000"

/**
 * `/credits` is both a React Router page and `GET /credits` on the API.
 * Browser navigations (Stripe return, sidebar link) have no Bearer token and
 * often Accept: text/html — serve the SPA. Authenticated fetch/XHR still proxy.
 */
function creditsProxy(): ProxyOptions {
  return {
    target: BACKEND,
    changeOrigin: true,
    bypass(req) {
      const pathname = (req.url ?? "").split("?", 1)[0] ?? ""

      // Always proxy nested API routes: /credits/checkout, /credits/redeem
      if (pathname.startsWith("/credits/")) {
        return
      }

      const isDocumentNav =
        req.method === "GET" &&
        pathname === "/credits" &&
        (!req.headers.authorization ||
          (req.headers.accept ?? "").includes("text/html") ||
          req.headers["sec-fetch-dest"] === "document")

      if (isDocumentNav) {
        return "/index.html"
      }
    },
  }
}

function apiProxy(): ProxyOptions {
  return {
    target: BACKEND,
    changeOrigin: true,
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/health": apiProxy(),
      "/me": apiProxy(),
      "/api-keys": apiProxy(),
      "/chats": apiProxy(),
      "/credits": creditsProxy(),
      "/models": apiProxy(),
    },
  },
})
