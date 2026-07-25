import { AccountDialogsProvider } from "@/providers/account-dialogs-provider"
import { ChatStreamProvider } from "@/providers/chat-stream-provider"
import { AppShell } from "@/components/app-shell"

/** Authenticated chrome — lazy-loaded so `/login` stays out of the chat bundle. */
export function AuthenticatedLayout() {
  return (
    <ChatStreamProvider>
      <AccountDialogsProvider>
        <AppShell />
      </AccountDialogsProvider>
    </ChatStreamProvider>
  )
}
