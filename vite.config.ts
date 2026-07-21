import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

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
      "/health": "http://localhost:4000",
      "/me": "http://localhost:4000",
      "/api-keys": "http://localhost:4000",
      "/chats": "http://localhost:4000",
      "/credits": "http://localhost:4000",
      "/models": "http://localhost:4000",
    },
  },
})
