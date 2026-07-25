import { useSyncExternalStore } from "react"

const MOBILE_BREAKPOINT = 768
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function getMobileMql() {
  return window.matchMedia(MOBILE_QUERY)
}

function subscribeMobile(onChange: () => void) {
  const mql = getMobileMql()
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

function getMobileSnapshot() {
  return getMobileMql().matches
}

function getServerMobileSnapshot() {
  return false
}

/**
 * Tracks the `md` breakpoint. Uses `useSyncExternalStore` so updates stay in
 * sync with the browser instead of lagging a paint behind via useEffect.
 */
export function useIsMobile() {
  return useSyncExternalStore(
    subscribeMobile,
    getMobileSnapshot,
    getServerMobileSnapshot
  )
}
