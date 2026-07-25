import { ApiKeyForm } from "@/components/api-key-form"

export function KeysPage() {
  return (
    <div className="scrollbar-chat min-h-0 flex-1 [scrollbar-gutter:auto]! overflow-y-auto">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 p-4 sm:p-6">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            API keys
          </h1>
          <p className="mt-1 text-sm text-pretty text-muted-foreground">
            Bring your own OpenAI, Claude, or Gemini key. Only the last four
            characters are stored for display.
          </p>
        </div>
        <ApiKeyForm />
      </div>
    </div>
  )
}
