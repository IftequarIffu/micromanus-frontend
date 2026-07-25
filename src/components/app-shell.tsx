import { Suspense, useEffect, useState } from "react"
import { Outlet, useMatch } from "react-router"
import { ChartColumnIcon, MessageSquareIcon } from "lucide-react"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
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
        className="relative min-h-0 min-w-0 overflow-hidden"
        tabIndex={-1}
      >
        <Tabs
          value={chatTab}
          onValueChange={(value) => {
            if (typeof value === "string") setChatTab(value)
          }}
          className="flex h-full min-h-0 flex-1 flex-col gap-0 overflow-hidden"
        >
          <header className="glass-panel absolute inset-x-0 top-0 z-20 grid h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-border/50 px-3 sm:gap-3 sm:px-4">
            <div className="flex min-w-0 items-center">
              {/* Opens the sheet on mobile; on desktop the sidebar has its own trigger. */}
              <SidebarTrigger className="md:hidden" />
            </div>

            <div className="flex min-w-0 justify-center overflow-hidden">
              {showChatTabs ? (
                <TabsList
                  variant="line"
                  className="h-9 gap-2 rounded-none bg-transparent p-0 sm:gap-4"
                  aria-label="Chat views"
                >
                  <TabsTrigger
                    value="chat"
                    className="flex-none px-1"
                    aria-label="Chat"
                  >
                    <MessageSquareIcon data-icon="inline-start" />
                    <span className="hidden sm:inline">Chat</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="usage"
                    className="flex-none px-1"
                    aria-label="Usage"
                    disabled={isStreaming && !chatMatch}
                  >
                    <ChartColumnIcon data-icon="inline-start" />
                    <span className="hidden sm:inline">Usage</span>
                  </TabsTrigger>
                </TabsList>
              ) : null}
            </div>

            <div className="flex min-w-0 items-center justify-end gap-1.5 sm:gap-2">
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
