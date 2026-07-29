import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import type { CreditsCheckoutStatus } from "@/components/credits-panel"

const ApiKeyForm = lazy(() =>
  import("@/components/api-key-form").then((m) => ({ default: m.ApiKeyForm }))
)
const CreditsPanel = lazy(() =>
  import("@/components/credits-panel").then((m) => ({ default: m.CreditsPanel }))
)

type OpenCreditsOptions = {
  checkout?: CreditsCheckoutStatus | null
}

type AccountDialogsContextValue = {
  openApiKeys: () => void
  openCredits: (options?: OpenCreditsOptions) => void
}

const AccountDialogsContext = createContext<AccountDialogsContextValue | null>(
  null
)

function DialogBodyFallback() {
  return (
    <div className="flex min-h-40 items-center justify-center py-8">
      <Spinner className="size-5" />
    </div>
  )
}

export function AccountDialogsProvider({ children }: { children: ReactNode }) {
  const [keysOpen, setKeysOpen] = useState(false)
  const [creditsOpen, setCreditsOpen] = useState(false)
  const [checkout, setCheckout] = useState<CreditsCheckoutStatus | null>(null)
  // Focus the panel on open — not the first input (which would select "5").
  const creditsDialogRef = useRef<HTMLDivElement>(null)

  const openApiKeys = useCallback(() => {
    setCreditsOpen(false)
    setKeysOpen(true)
  }, [])

  const openCredits = useCallback((options?: OpenCreditsOptions) => {
    setKeysOpen(false)
    setCheckout(options?.checkout ?? null)
    setCreditsOpen(true)
  }, [])

  const value = useMemo(
    () => ({ openApiKeys, openCredits }),
    [openApiKeys, openCredits]
  )

  return (
    <AccountDialogsContext.Provider value={value}>
      {children}

      <Dialog open={keysOpen} onOpenChange={setKeysOpen}>
        <DialogContent className="flex max-h-[min(90svh,40rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogHeader className="shrink-0 border-b border-border/60 px-6 py-5">
            <DialogTitle>API keys</DialogTitle>
            <DialogDescription>
              Bring your own OpenAI, Claude, or Gemini key. Only the last four
              characters are stored for display.
            </DialogDescription>
          </DialogHeader>
          <div className="scrollbar-chat min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {keysOpen ? (
              <Suspense fallback={<DialogBodyFallback />}>
                <ApiKeyForm />
              </Suspense>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={creditsOpen}
        onOpenChange={(open) => {
          setCreditsOpen(open)
          if (!open) setCheckout(null)
        }}
      >
        <DialogContent
          ref={creditsDialogRef}
          initialFocus={creditsDialogRef}
          className="flex max-h-[min(90svh,40rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"
        >
          <DialogHeader className="shrink-0 border-b border-border/60 px-6 py-5">
            <DialogTitle>Credits</DialogTitle>
            <DialogDescription>
              Platform credits meter micromanus access. Your LLM provider is
              billed separately via your own key.
            </DialogDescription>
          </DialogHeader>
          <div className="scrollbar-chat min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {creditsOpen ? (
              <Suspense fallback={<DialogBodyFallback />}>
                <CreditsPanel checkout={checkout} />
              </Suspense>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </AccountDialogsContext.Provider>
  )
}

export function useAccountDialogs() {
  const ctx = useContext(AccountDialogsContext)
  if (!ctx) {
    throw new Error(
      "useAccountDialogs must be used within AccountDialogsProvider"
    )
  }
  return ctx
}
