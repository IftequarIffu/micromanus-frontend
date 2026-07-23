import { BrowserRouter, Navigate, Route, Routes } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AppShell } from "@/components/app-shell"
import { ProtectedRoute } from "@/components/protected-route"
import { AuthProvider } from "@/providers/auth-provider"
import { ChatStreamProvider } from "@/providers/chat-stream-provider"
import { LoginPage } from "@/pages/login-page"
import { ChatWorkspace } from "@/pages/chat-workspace"
import { KeysPage } from "@/pages/keys-page"
import { CreditsPage } from "@/pages/credits-page"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <ChatStreamProvider>
                      <AppShell />
                    </ChatStreamProvider>
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="/new" replace />} />
                {/* Layout stays mounted across /new → /chat/:id on chat_created. */}
                <Route element={<ChatWorkspace />}>
                  <Route path="new" />
                  <Route path="chat/:chatId" />
                </Route>
                <Route path="settings/keys" element={<KeysPage />} />
                <Route path="credits" element={<CreditsPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/new" replace />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  )
}

export default App
