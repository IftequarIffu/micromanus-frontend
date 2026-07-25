import { Suspense, useEffect, useState } from "react"
import { Outlet, useMatch } from "react-router"
import { ChartColumnIcon, MessageSquareIcon } from "lucide-react"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChatSidebar } from "@/components/chat-sidebar"
import { CreditBadge } from "@/components/credit-badge"
import { ThemeToggle } from "@/components/theme-toggle"
import { Spinner } from "@/components/ui/spinner"
import { useChatStream } from "@/providers/chat-stream-provider"

export function AppShell() {
  const chatMatch = useMatch("/chat/:chatId")
  const { streamingChatId, isStreaming } = useChatStream()
  const [chatTab, setChatTab] = useState("chat")

  // Show chat/usage tabs as soon as a real chat id exists (including the
  // brief `/new` handoff after `chat_created`, before the URL updates).
  const chatId = chatMatch?.params.chatId ?? streamingChatId ?? undefined
  const showChatTabs = Boolean(chatId)

  useEffect(() => {
    setChatTab("chat")
  }, [chatId])

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <ChatSidebar />
      <SidebarInset
        id="main-content"
        className="relative min-h-0 overflow-hidden"
        tabIndex={-1}
      >
        <Tabs
          value={chatTab}
          onValueChange={(value) => {
            if (typeof value === "string") setChatTab(value)
          }}
          className="flex h-full min-h-0 flex-1 flex-col gap-0 overflow-hidden"
        >
          <header className="glass-panel absolute inset-x-0 top-0 z-20 grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-border/50 px-4">
            <div />

            <div className="flex justify-center">
              {showChatTabs ? (
                <TabsList
                  variant="line"
                  className="h-9 gap-4 rounded-none bg-transparent p-0"
                  aria-label="Chat views"
                >
                  <TabsTrigger value="chat" className="flex-none px-1">
                    <MessageSquareIcon data-icon="inline-start" />
                    Chat
                  </TabsTrigger>
                  <TabsTrigger
                    value="usage"
                    className="flex-none px-1"
                    disabled={isStreaming && !chatMatch}
                  >
                    <ChartColumnIcon data-icon="inline-start" />
                    Usage
                  </TabsTrigger>
                </TabsList>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-2">
              <ThemeToggle />
              <CreditBadge />
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden pt-14">
            <Suspense
              fallback={
                <div className="flex flex-1 items-center justify-center">
                  <Spinner className="size-6" />
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </div>
        </Tabs>
      </SidebarInset>
    </SidebarProvider>
  )
}
