import { cn } from "@/lib/utils"
import {
  memo,
  useEffect,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react"

type StreamdownComponent = typeof import("streamdown").Streamdown
type StreamdownProps = ComponentProps<StreamdownComponent>
type StreamdownPlugins = NonNullable<StreamdownProps["plugins"]>

export type MessageResponseProps = {
  children?: ReactNode
  className?: string
  isAnimating?: boolean
} & Omit<
  StreamdownProps,
  "children" | "className" | "isAnimating" | "plugins"
>

function contentText(children: ReactNode): string {
  return typeof children === "string" ? children : ""
}

function needsCode(text: string): boolean {
  return /```/.test(text)
}

function needsMath(text: string): boolean {
  return /\$\$[\s\S]+?\$\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\]/.test(text)
}

function needsMermaid(text: string): boolean {
  return /```\s*mermaid\b/i.test(text)
}

function needsCjk(text: string): boolean {
  // CJK Unified Ideographs + Hiragana/Katakana + Hangul syllables
  return /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(text)
}

type Loaded = {
  Streamdown: StreamdownComponent
  plugins: StreamdownPlugins
}

let cssLoaded = false
let streamdownPromise: Promise<StreamdownComponent> | null = null

function loadCss() {
  if (cssLoaded) return Promise.resolve()
  return import("@/styles/chat-markdown.css").then(() => {
    cssLoaded = true
  })
}

function loadStreamdown() {
  if (!streamdownPromise) {
    streamdownPromise = import("streamdown").then((m) => m.Streamdown)
  }
  return streamdownPromise
}

async function loadRenderer(text: string): Promise<Loaded> {
  await loadCss()
  const Streamdown = await loadStreamdown()
  const plugins = {} as StreamdownPlugins

  const extras: Promise<void>[] = []

  if (needsCode(text) || needsMermaid(text)) {
    extras.push(
      import("@streamdown/code").then((m) => {
        ;(plugins as { code?: unknown }).code = m.code
      })
    )
  }
  if (needsCjk(text)) {
    extras.push(
      import("@streamdown/cjk").then((m) => {
        ;(plugins as { cjk?: unknown }).cjk = m.cjk
      })
    )
  }
  if (needsMath(text)) {
    extras.push(
      import("@streamdown/math").then((m) => {
        ;(plugins as { math?: unknown }).math = m.math
      })
    )
  }
  if (needsMermaid(text)) {
    extras.push(
      import("@streamdown/mermaid").then((m) => {
        ;(plugins as { mermaid?: unknown }).mermaid = m.mermaid
      })
    )
  }

  await Promise.all(extras)
  return { Streamdown, plugins }
}

function yieldForInteraction(): Promise<void> {
  return new Promise((resolve) => {
    const run = () => resolve()
    const ric = window.requestIdleCallback
    if (typeof ric === "function") {
      ric(run, { timeout: 400 })
    } else {
      requestAnimationFrame(() => setTimeout(run, 0))
    }
  })
}

/**
 * Markdown renderer for assistant messages. Streamdown (+ Shiki/KaTeX/Mermaid)
 * load after first paint; heavy plugins only when the content needs them.
 */
export const MessageResponse = memo(
  ({ className, children, isAnimating, ...props }: MessageResponseProps) => {
    const text = contentText(children)
    const wantCode = needsCode(text) || needsMermaid(text)
    const wantMath = needsMath(text)
    const wantMermaid = needsMermaid(text)
    const wantCjk = needsCjk(text)
    const [loaded, setLoaded] = useState<Loaded | null>(null)

    useEffect(() => {
      let cancelled = false

      void (async () => {
        await yieldForInteraction()
        try {
          const next = await loadRenderer(text)
          if (!cancelled) setLoaded(next)
        } catch {
          // Keep plain-text fallback if the markdown stack fails to load.
        }
      })()

      return () => {
        cancelled = true
      }
      // Feature flags only — full `text` changes every streamed token.
    }, [wantCode, wantMath, wantMermaid, wantCjk])

    if (!loaded) {
      return (
        <div
          className={cn(
            "size-full max-w-full min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere] break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
            className
          )}
        >
          {text}
        </div>
      )
    }

    const { Streamdown, plugins } = loaded
    return (
      <Streamdown
        className={cn(
          "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
          className
        )}
        isAnimating={isAnimating}
        plugins={plugins}
        {...props}
      >
        {text}
      </Streamdown>
    )
  },
  (prevProps, nextProps) =>
    prevProps.children === nextProps.children &&
    nextProps.isAnimating === prevProps.isAnimating
)

MessageResponse.displayName = "MessageResponse"
