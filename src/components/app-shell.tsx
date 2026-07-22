import { Outlet } from "react-router"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { ChatSidebar } from "@/components/chat-sidebar"
import { CreditBadge } from "@/components/credit-badge"

export function AppShell() {
  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <ChatSidebar />
      <SidebarInset className="relative min-h-0 overflow-hidden">
        <header className="glass-panel absolute inset-x-0 top-0 z-20 flex h-14 items-center gap-3 border-b border-border/50 px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <div className="flex flex-1 items-center justify-end">
            <CreditBadge />
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden pt-14">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
