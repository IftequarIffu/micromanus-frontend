import { lazy, Suspense } from "react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Spinner } from "@/components/ui/spinner"
import { DocumentMeta } from "@/components/document-meta"
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
const OpenAccountDialogRoute = lazy(() =>
  import("@/pages/open-account-dialog-route").then((m) => ({
    default: m.OpenAccountDialogRoute,
  }))
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
            <DocumentMeta />
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
                {/* Deep links / Stripe return → open dialogs, then /new. */}
                <Route
                  path="settings/keys"
                  element={<OpenAccountDialogRoute dialog="keys" />}
                />
                <Route
                  path="credits"
                  element={<OpenAccountDialogRoute dialog="credits" />}
                />
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
