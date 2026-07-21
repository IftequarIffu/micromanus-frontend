import { Navigate } from "react-router"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/providers/auth-provider"

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...props}>
      <path
        fill="currentColor"
        d="M21.6 12.23c0-.68-.06-1.33-.17-1.96H12v3.71h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.89-1.74 2.98-4.3 2.98-7.27Z"
      />
      <path
        fill="currentColor"
        d="M12 22c2.7 0 4.97-.9 6.63-2.43l-3.24-2.5c-.9.6-2.05.96-3.39.96-2.6 0-4.81-1.76-5.6-4.12H3.06v2.58A10 10 0 0 0 12 22Z"
      />
      <path
        fill="currentColor"
        d="M6.4 13.91a6 6 0 0 1 0-3.82V7.51H3.06a10 10 0 0 0 0 8.98l3.34-2.58Z"
      />
      <path
        fill="currentColor"
        d="M12 5.96c1.47 0 2.79.5 3.83 1.5l2.87-2.87C16.96 2.97 14.7 2 12 2A10 10 0 0 0 3.06 7.51l3.34 2.58C7.19 7.72 9.4 5.96 12 5.96Z"
      />
    </svg>
  )
}

function GitHubIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...props}>
      <path
        fill="currentColor"
        d="M12 2C6.48 2 2 6.58 2 12.26c0 4.52 2.87 8.35 6.84 9.71.5.1.68-.22.68-.48 0-.24-.01-.87-.01-1.71-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.31.1-2.73 0 0 .84-.27 2.75 1.05A9.3 9.3 0 0 1 12 6.84c.85 0 1.71.12 2.51.35 1.9-1.32 2.74-1.05 2.74-1.05.55 1.42.2 2.47.1 2.73.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .26.18.58.69.48A10.03 10.03 0 0 0 22 12.26C22 6.58 17.52 2 12 2Z"
      />
    </svg>
  )
}

export function LoginPage() {
  const { session, loading, signInWithGoogle, signInWithGitHub } = useAuth()

  if (!loading && session) {
    return <Navigate to="/new" replace />
  }

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_oklch(0.95_0.02_250),_transparent_55%),radial-gradient(ellipse_at_bottom,_oklch(0.94_0.03_80),_transparent_50%)] dark:bg-[radial-gradient(ellipse_at_top,_oklch(0.28_0.04_250),_transparent_55%),radial-gradient(ellipse_at_bottom,_oklch(0.22_0.03_80),_transparent_50%)]"
      />
      <div className="relative z-10 flex w-full max-w-sm flex-col gap-8">
        <div className="flex flex-col gap-2 text-center">
          <h1 className="font-heading text-4xl font-semibold tracking-tight">
            micromanus
          </h1>
          <p className="text-muted-foreground text-sm">
            Multi-model chat with your own keys, platform credits, and live
            citations.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <Button
            size="lg"
            className="w-full"
            onClick={() => {
              void signInWithGoogle().catch((err: Error) =>
                toast.error(err.message)
              )
            }}
          >
            <GoogleIcon data-icon="inline-start" className="size-4" />
            Continue with Google
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="w-full"
            onClick={() => {
              void signInWithGitHub().catch((err: Error) =>
                toast.error(err.message)
              )
            }}
          >
            <GitHubIcon data-icon="inline-start" className="size-4" />
            Continue with GitHub
          </Button>
        </div>
      </div>
    </div>
  )
}
