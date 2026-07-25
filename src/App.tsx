import { lazy, Suspense } from "react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Spinner } from "@/components/ui/spinner"
import { ProtectedRoute } from "@/components/protected-route"
import { AuthProvider } from "@/providers/auth-provider"
import { LoginPage } from "@/pages/login-page"

const AuthenticatedLayout = lazy(() =>
  import("@/pages/authenticated-layout").then((m) => ({
    default: m.AuthenticatedLayout,
  }))
)
const ChatWorkspace = lazy(() =>
  import("@/pages/chat-workspace").then((m) => ({
    default: m.ChatWorkspace,
  }))
)
const KeysPage = lazy(() =>
  import("@/pages/keys-page").then((m) => ({ default: m.KeysPage }))
)
const CreditsPage = lazy(() =>
  import("@/pages/credits-page").then((m) => ({ default: m.CreditsPage }))
)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
})

function FullPageFallback() {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <Spinner className="size-6" />
    </div>
  )
}

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
                    <Suspense fallback={<FullPageFallback />}>
                      <AuthenticatedLayout />
                    </Suspense>
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
