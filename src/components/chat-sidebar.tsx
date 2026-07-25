import { useEffect, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router"
import { toast } from "sonner"
import {
  KeyRoundIcon,
  LogOutIcon,
  MessageSquarePlusIcon,
  Trash2Icon,
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
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { BrandWordmark } from "@/components/brand-wordmark"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { readChatList, removeChatListItem } from "@/lib/chat-list"
import { messageForCode } from "@/lib/errors"
import { ApiError } from "@/lib/api"
import type { ChatListItem } from "@/lib/types"
import { useAuth } from "@/providers/auth-provider"
import { useChatStream } from "@/providers/chat-stream-provider"
import { useChats, useDeleteChat, useMe } from "@/hooks/use-api"

export function ChatSidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { signOut, user } = useAuth()
  const { isMobile, setOpenMobile } = useSidebar()
  const userId = user?.id
  const { data: me } = useMe()
  // DB is source of truth via useChats → syncChatListFromServer; localStorage
  // is the paint cache (optimistic upserts + instant reload).
  useChats()
  const { activeChatId, clearThread } = useChatStream()
  const deleteChat = useDeleteChat()
  const [chats, setChats] = useState<ChatListItem[]>(() => readChatList(userId))
  const [pendingDelete, setPendingDelete] = useState<ChatListItem | null>(null)

  // Close the mobile sheet after navigation so it doesn’t cover the page.
  useEffect(() => {
    if (isMobile) setOpenMobile(false)
  }, [location.pathname, isMobile, setOpenMobile])

  useEffect(() => {
    const refresh = () => setChats(readChatList(userId))
    refresh()
    window.addEventListener("micromanus:chat-list-updated", refresh)
    window.addEventListener("storage", refresh)
    return () => {
      window.removeEventListener("micromanus:chat-list-updated", refresh)
      window.removeEventListener("storage", refresh)
    }
  }, [userId])

  async function confirmDelete() {
    if (!pendingDelete || !userId) return
    const { chatId } = pendingDelete
    try {
      await deleteChat.mutateAsync(chatId)
      removeChatListItem(userId, chatId)
      setPendingDelete(null)

      clearThread(chatId)
      if (activeChatId === chatId || location.pathname === `/chat/${chatId}`) {
        navigate("/new", { replace: true })
      }
      toast.success("Chat deleted")
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "unknown"
      toast.error(
        messageForCode(
          code,
          err instanceof Error ? err.message : "Failed to delete chat."
        )
      )
    }
  }

  return (
    <>
      <Sidebar
        collapsible="icon"
        role="navigation"
        aria-label="Main navigation"
      >
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <div className="flex w-full items-center gap-1 group-data-[collapsible=icon]:justify-center">
                <Link
                  to="/"
                  aria-label="micromanus home"
                  className="inline-flex min-w-0 cursor-pointer items-center rounded-lg px-2 py-2 outline-none group-data-[collapsible=icon]:hidden focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <BrandWordmark size="md" />
                </Link>
                <SidebarTrigger className="ml-auto group-data-[collapsible=icon]:ml-0" />
              </div>
            </SidebarMenuItem>
            <SidebarMenuItem className="mt-6">
              <SidebarMenuButton render={<Link to="/new" />} tooltip="New chat">
                <MessageSquarePlusIcon />
                <span>New chat</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            <SidebarGroupLabel>Chats</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {chats.length === 0 ? (
                  <SidebarMenuItem>
                    <SidebarMenuButton disabled>
                      <span className="text-muted-foreground">
                        No chats yet
                      </span>
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
                      <SidebarMenuAction
                        showOnHover
                        title="Delete chat"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setPendingDelete(chat)
                        }}
                      >
                        <Trash2Icon />
                        <span className="sr-only">Delete chat</span>
                      </SidebarMenuAction>
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
                aria-label={me?.email ? `Sign out (${me.email})` : "Sign out"}
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

      <Dialog
        open={pendingDelete != null}
        onOpenChange={(open) => {
          if (!open && !deleteChat.isPending) setPendingDelete(null)
        }}
      >
        <DialogContent showCloseButton={!deleteChat.isPending}>
          <DialogHeader>
            <DialogTitle>Delete chat?</DialogTitle>
            <DialogDescription>
              This permanently deletes “{pendingDelete?.title ?? "this chat"}”,
              all of its messages, and any PDFs generated in it. This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={deleteChat.isPending}
              onClick={() => setPendingDelete(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteChat.isPending}
              onClick={() => void confirmDelete()}
            >
              {deleteChat.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
