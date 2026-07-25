import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router"
import { ChevronsUpDownIcon } from "lucide-react"
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input"
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "@/components/ai-elements/model-selector"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useApiKeys, useCredits, useModels } from "@/hooks/use-api"
import { useChatStream } from "@/providers/chat-stream-provider"
import { cn } from "@/lib/utils"

const MODEL_STORAGE_KEY = "micromanus.selected-model"

type ChatComposerProps = {
  chatId?: string
  /** Pin as a bottom bar (border + background). Off for the centered empty state. */
  sticky?: boolean
}

export function ChatComposer({ chatId, sticky = false }: ChatComposerProps) {
  const { data: models, isLoading: modelsLoading } = useModels()
  const { data: keys } = useApiKeys()
  const { data: credits } = useCredits()
  const { sendMessage, isStreaming, stop } = useChatStream()
  const [modelId, setModelId] = useState<string>(() => {
    return localStorage.getItem(MODEL_STORAGE_KEY) ?? ""
  })
  const [selectorOpen, setSelectorOpen] = useState(false)

  useEffect(() => {
    if (!models?.length) return
    const exists = models.some((m) => m.id === modelId)
    if (!exists) {
      const next = models[0].id
      setModelId(next)
      localStorage.setItem(MODEL_STORAGE_KEY, next)
    }
  }, [models, modelId])

  const selected = useMemo(
    () => models?.find((m) => m.id === modelId),
    [models, modelId]
  )

  const hasKey = useMemo(() => {
    if (!selected || !keys) return true
    return keys.some((k) => k.provider === selected.provider)
  }, [keys, selected])

  const balanceOk = credits == null || credits.balance > 0

  const grouped = useMemo(() => {
    const map = new Map<string, typeof models>()
    for (const m of models ?? []) {
      const list = map.get(m.provider) ?? []
      list.push(m)
      map.set(m.provider, list)
    }
    return map
  }, [models])

  async function onSubmit(message: PromptInputMessage) {
    const text = message.text.trim()
    if (!text || !modelId) return

    if (!hasKey) return
    if (!balanceOk) return

    await sendMessage({ content: text, model: modelId, chatId })
  }

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-3xl min-w-0",
        sticky &&
          "glass-panel z-20 shrink-0 rounded-t-xl border border-b-0 border-border/50"
      )}
    >
      <div className="flex flex-col gap-3 p-3 sm:p-4">
        {!hasKey && selected ? (
          <Alert>
            <AlertTitle>API key required</AlertTitle>
            <AlertDescription>
              Add a {selected.provider} key in{" "}
              <Link
                className="rounded-sm underline outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                to="/settings/keys"
              >
                Settings → API keys
              </Link>{" "}
              before chatting with {selected.label}.
            </AlertDescription>
          </Alert>
        ) : null}

        {credits && credits.balance <= 0 ? (
          <Alert>
            <AlertTitle>Out of credits</AlertTitle>
            <AlertDescription>
              Buy a package or redeem a coupon on the{" "}
              <Link
                className="rounded-sm underline outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                to="/credits"
              >
                credits page
              </Link>
              .
            </AlertDescription>
          </Alert>
        ) : null}

        <PromptInput onSubmit={onSubmit}>
          <PromptInputBody>
            <PromptInputTextarea
              aria-label="Message"
              placeholder="Ask anything…"
              disabled={isStreaming || modelsLoading}
            />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              <ModelSelector open={selectorOpen} onOpenChange={setSelectorOpen}>
                <ModelSelectorTrigger
                  render={
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      aria-label={
                        selected
                          ? `Model: ${selected.label}. Change model`
                          : "Select model"
                      }
                    />
                  }
                >
                  <span className="max-w-[7.5rem] truncate sm:max-w-40">
                    {selected?.label ?? "Select model"}
                  </span>
                  <ChevronsUpDownIcon data-icon="inline-end" />
                </ModelSelectorTrigger>
                <ModelSelectorContent title="Select a model">
                  <ModelSelectorInput
                    placeholder="Search models…"
                    aria-label="Search models"
                  />
                  <ModelSelectorList>
                    <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
                    {[...grouped.entries()].map(([provider, list]) => (
                      <ModelSelectorGroup key={provider} heading={provider}>
                        {list?.map((m) => (
                          <ModelSelectorItem
                            key={m.id}
                            value={m.id}
                            onSelect={() => {
                              setModelId(m.id)
                              localStorage.setItem(MODEL_STORAGE_KEY, m.id)
                              setSelectorOpen(false)
                            }}
                          >
                            <ModelSelectorName>{m.label}</ModelSelectorName>
                          </ModelSelectorItem>
                        ))}
                      </ModelSelectorGroup>
                    ))}
                  </ModelSelectorList>
                </ModelSelectorContent>
              </ModelSelector>
            </PromptInputTools>
            <PromptInputSubmit
              status={isStreaming ? "streaming" : "ready"}
              disabled={!hasKey || !balanceOk || modelsLoading}
              onStop={stop}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  )
}
