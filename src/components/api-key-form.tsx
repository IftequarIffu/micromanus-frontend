import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api"
import { messageForCode } from "@/lib/errors"
import type { Provider } from "@/lib/types"
import {
  useApiKeys,
  useDeleteApiKey,
  useSaveApiKey,
} from "@/hooks/use-api"

const PROVIDERS: { value: Provider; label: string }[] = [
  { value: "openai", label: "OpenAI" },
  { value: "claude", label: "Claude" },
  { value: "gemini", label: "Gemini" },
]

const providerItems = [
  { label: "Select provider", value: null },
  ...PROVIDERS.map((p) => ({ label: p.label, value: p.value })),
]

export function ApiKeyForm() {
  const { data: keys, isLoading } = useApiKeys()
  const save = useSaveApiKey()
  const remove = useDeleteApiKey()
  const [provider, setProvider] = useState<Provider | null>("openai")
  const [apiKey, setApiKey] = useState("")

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!provider || !apiKey.trim()) {
      toast.error("Provider and API key are required.")
      return
    }

    try {
      await save.mutateAsync({ provider, apiKey: apiKey.trim() })
      toast.success("API key saved.")
      setApiKey("")
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "unknown"
      toast.error(messageForCode(code, err instanceof Error ? err.message : undefined))
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 p-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          API keys
        </h1>
        <p className="text-muted-foreground text-sm">
          Bring your own OpenAI, Claude, or Gemini key. Only the last four
          characters are stored for display.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Save a key</CardTitle>
          <CardDescription>
            Keys are encrypted on the server. They never leave your BYOK vault
            in plaintext.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="api-key-provider">Provider</FieldLabel>
                <Select
                  items={providerItems}
                  value={provider}
                  onValueChange={(value) =>
                    setProvider((value as Provider | null) ?? null)
                  }
                >
                  <SelectTrigger id="api-key-provider" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {PROVIDERS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="api-key">API key</FieldLabel>
                <Input
                  id="api-key"
                  type="password"
                  autoComplete="off"
                  placeholder="sk-…"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  aria-describedby="api-key-description"
                />
                <FieldDescription id="api-key-description">
                  Paste the full key once. It won’t be shown again.
                </FieldDescription>
              </Field>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? <Spinner data-icon="inline-start" /> : null}
                Save key
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Saved keys</CardTitle>
          <CardDescription>Masked keys for each provider.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Spinner />
          ) : !keys?.length ? (
            <p className="text-muted-foreground text-sm">No keys saved yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {keys.map((key) => (
                <li
                  key={key.provider}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{key.provider}</Badge>
                    <span className="font-mono text-sm">••••{key.last_four}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={remove.isPending}
                    aria-label={`Delete ${key.provider} API key`}
                    onClick={async () => {
                      try {
                        await remove.mutateAsync(key.provider)
                        toast.success(`Removed ${key.provider} key.`)
                      } catch (err) {
                        const code =
                          err instanceof ApiError ? err.code : "unknown"
                        toast.error(messageForCode(code))
                      }
                    }}
                  >
                    Delete
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
