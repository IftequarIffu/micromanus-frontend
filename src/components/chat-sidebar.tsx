import { useEffect, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router"
import {
  KeyRoundIcon,
  LogOutIcon,
  MessageSquarePlusIcon,
  WalletIcon,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { readChatList } from "@/lib/chat-list"
import type { ChatListItem } from "@/lib/types"
import { useAuth } from "@/providers/auth-provider"
import { useMe } from "@/hooks/use-api"

export function ChatSidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const { data: me } = useMe()
  const [chats, setChats] = useState<ChatListItem[]>(() => readChatList())

  useEffect(() => {
    const refresh = () => setChats(readChatList())
    refresh()
    window.addEventListener("micromanus:chat-list-updated", refresh)
    window.addEventListener("storage", refresh)
    return () => {
      window.removeEventListener("micromanus:chat-list-updated", refresh)
      window.removeEventListener("storage", refresh)
    }
  }, [location.pathname])

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link to="/new" />}
              tooltip="micromanus"
            >
              <span className="font-heading text-base font-semibold tracking-tight">
                micromanus
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={location.pathname === "/new" || location.pathname === "/"}
              render={<Link to="/new" />}
              tooltip="New chat"
            >
              <MessageSquarePlusIcon />
              <span>New chat</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Chats</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {chats.length === 0 ? (
                <SidebarMenuItem>
                  <SidebarMenuButton disabled>
                    <span className="text-muted-foreground">No chats yet</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : (
                chats.map((chat) => (
                  <SidebarMenuItem key={chat.chatId}>
                    <SidebarMenuButton
                      isActive={location.pathname === `/chat/${chat.chatId}`}
                      render={<Link to={`/chat/${chat.chatId}`} />}
                      tooltip={chat.title}
                    >
                      <span className="truncate">{chat.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={location.pathname.startsWith("/settings")}
              render={<Link to="/settings/keys" />}
              tooltip="API keys"
            >
              <KeyRoundIcon />
              <span>API keys</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={location.pathname.startsWith("/credits")}
              render={<Link to="/credits" />}
              tooltip="Credits"
            >
              <WalletIcon />
              <span>Credits</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Sign out"
              onClick={() => {
                void signOut().then(() => navigate("/login"))
              }}
            >
              <LogOutIcon />
              <span className="truncate">{me?.email ?? "Sign out"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
