import { BrowserRouter, Navigate, Route, Routes } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AppShell } from "@/components/app-shell"
import { ProtectedRoute } from "@/components/protected-route"
import { AuthProvider } from "@/providers/auth-provider"
import { ChatStreamProvider } from "@/providers/chat-stream-provider"
import { LoginPage } from "@/pages/login-page"
import { NewChatPage } from "@/pages/new-chat-page"
import { ChatPage } from "@/pages/chat-page"
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
                <Route path="new" element={<NewChatPage />} />
                <Route path="chat/:chatId" element={<ChatPage />} />
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
