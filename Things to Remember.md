# Things to Remember

Living notes for humans and AI agents building **micromanus**. Prefer keeping these constraints in mind while implementing — not only during QA.

When useful, copy or link a section into `AGENTS.md` so agents treat it as a build contract.

---

## 1. Browser throttle test (slow network / CPU)

Assume users are on **Fast 3G** (or worse), with a cold cache, and sometimes a slow CPU. Build so the UI never feels broken under that load.

Test fairly with **`vite preview`** (or a deployed URL), not only `vite` / `bun run dev`. Dev serves many unbundled modules and exaggerates cold-load pain.

### 1.1 Blank-screen test (initial page load)

**What to do:** With **Slow 3G** and **Disable cache** active, hard refresh (`Cmd/Ctrl + Shift + R`). Watch the screen carefully — including OAuth return and hard reload of `/login`, `/new`, `/chat/:id`, `/credits`, etc.

**Expected behavior:** The user should **never stare at a blank white or black screen** with no sign of life. As soon as the HTML document arrives (ideally within ~1–2 seconds on Slow 3G for the document itself), they should see something that proves the app is alive:

- layout shell / navigation / brand, **or**
- a boot splash / spinner, **or**
- a loading skeleton

Main data and heavy JS chunks may still be loading — that is fine. An empty `#root` with only the browser’s default background is a **fail**.

**How to build it (this stack is Vite + React Router, not Next.js):**

Do **not** add Next.js `loading.tsx` or App Router Server Components — micromanus is a Vite SPA. Achieve the same outcome with:

1. **Static HTML first paint** — keep a boot splash inside `#root` in `index.html` (brand + spinner, theme-aware). It ships with the document and shows before any JS executes. React’s `createRoot().render()` replaces it when the app mounts. Covers hard reload and OAuth return.
2. **Small login / entry JS** — code-split so `/login` does not wait on chat/markdown chunks before first interactive paint (see §1.5).
3. **Suspense fallbacks** — wrap `React.lazy` routes in `<Suspense>` with a spinner/skeleton. Prefer an **outlet-level** fallback so sidebar/header can stay mounted while a page chunk loads.
4. **Auth gate** — while session resolves, show a full-page spinner (`ProtectedRoute`), not an empty shell.
5. **Data loading** — use content skeletons/spinners while React Query fetches; paint the shell + cached sidebar immediately when possible (localStorage chat list). Don’t block the whole viewport on one slow request.
6. **Mutations** — separate concern (see §1.3); still never leave the page looking dead after a click.

**Layered timeline to aim for on a cold Slow 3G load:**

| Phase | User should see |
| --- | --- |
| HTML arrives | Boot splash (not blank) |
| Entry JS runs | Login UI or auth spinner |
| Auth + shell chunk | App chrome / nav |
| Page chunk + API | Skeleton → real content |

### 1.2 Always show loading / pending / error state

Every user-triggered async action must have a visible state machine:

| State | Required UX |
| --- | --- |
| Idle | Clear CTA |
| Pending | Spinner / Stop / disabled control; no “dead” UI |
| Success | Result in place, toast if helpful |
| Error | Inline field error and/or toast with `error.code` when present |

Fail closed on silence: if the network is slow, the user must still know “something is happening.”

### 1.3 Dead-click test (user interactions on Slow 3G)

**What to do:** Keep **Slow 3G** (or Fast 3G) active. Click any control that triggers a network request — form submit (keys, coupon, checkout), delete confirm, OAuth, send chat, opening UI that depends on a fetch, etc.

**Expected behavior:** The UI must **acknowledge the click instantly**. The user should never wonder “Did I click it hard enough?”

On click / submit, at least one of these must happen immediately (same frame / next paint — not after the response):

1. **Pending affordance** — button shows a spinner (or equivalent) and looks busy.
2. **Disable** — the control (and usually the whole form’s primary actions) disables so it can’t be clicked again.
3. **Optimistic UI** — the interface updates as if the action succeeded, then reconciles with the server.

Silent buttons that sit unchanged for seconds on Slow 3G are a **fail**.

**How to build it (agents):**

- Drive pending UI from real flags: React Query `isPending` / `isLoading`, chat `isStreaming`, or React `useTransition` / `useActionState` when that fits the form.
- **Disable** interactive elements (submit, confirm, duplicate CTAs) while `isPending`, `isLoading`, or `isStreaming` is true. For chat, Send may become **Stop** instead of a disabled Send — still an instant acknowledgment.
- Prefer **optimistic updates** for snappy UX where rollback is safe:
  - Chat: append the user message (and empty assistant placeholder) immediately; confirm on SSE `done`.
  - Lists / toggles: TanStack Query `onMutate` (+ cache rollback on error), or React `useOptimistic` when local UI state is enough.
- One in-flight mutation per form; do **not** queue duplicate POSTs from double-clicks.
- Dialog confirms (e.g. delete chat): disable Confirm until the mutation settles.
- OAuth / Stripe checkout: disable the button once the redirect is kicked off; keep pending until `window.location` changes.
- On error: restore non-optimistic UI, re-enable controls, show inline error and/or toast — never leave a stuck spinner with no message.

### 1.4 No multi-submit / double-click races

- Same rule as §1.3: pending + disable (or Stop) for the whole request lifetime.
- Ignore repeated clicks while `isPending` / `isStreaming`.
- Prefer one in-flight mutation per form; don’t queue duplicate POSTs.

### 1.5 JavaScript payload test (main-thread / mega-bundle)

**What to do:** In the Network tab, filter by **JS**. Hard reload the page (prefer `/login` first, then an authenticated route). Sort by **Size** and **Time**. Use **preview/deploy** builds — Vite dev’s many tiny modules are not the production shape.

**Expected behavior:**

- Multiple **smaller** JS chunks downloading (ideally in parallel), not one giant `bundle.js` / entry that is megabytes uncompressed and blocks first paint for many seconds.
- `/login` critical path stays lean (entry + small shared chunks). Heavy chat/markdown code appears only after auth → chat routes.
- The page should remain usable: boot splash → UI. A multi‑second frozen tab with no paint while one huge script downloads/parses is a **fail**.

**How to build it (this stack is Vite + React Router, not Next.js):**

Do **not** rely on Next.js Server Components, `"use client"`, or `next/dynamic` — micromanus is a client SPA. Achieve the same outcome with:

1. **Route-level code splitting** — `React.lazy(() => import(...))` + `<Suspense>` for authenticated layout, chat workspace, keys, credits.
2. **Eager only what `/login` needs** — auth, login page, tiny shared UI. Do **not** statically import chat thread / Streamdown / Mermaid / Shiki from `App.tsx` or the login graph.
3. **Feature-level `import()`** — load heavy third-party libraries only when needed (markdown plugins, Mermaid, large highlighters, charts, editors, maps), e.g. when the user opens chat or a message actually needs that plugin — not on first visit to `/login`.
4. **Avoid accidental eager pulls** — a single static `import` of a heavy module from a shared file re-bundles it into every consumer; keep heavy deps behind lazy route/feature boundaries.
5. **Watch `modulepreload`** — production `index.html` should not preload Mermaid/Rough/chat chunks on the login document. After build, confirm `dist/index.html` preloads stay minimal.
6. **Measure** — track main entry gzip size and login LCP; treat large regressions as bugs. Prefer several hundred‑KB (or smaller) chunks over a multi‑MB single entry.

**Rough guide (not hard SLOs):** login entry gzip well under ~150–200KB when possible; chat/markdown may live in a separate larger chunk loaded after navigation.

### 1.6 Streaming and navigation (chat-specific)

- Hold SSE stream state **above** the route outlet so `/new` → `/chat/:id` on `chat_created` does not abort `fetch`.
- Composer: while streaming, show **Stop** (or equivalent); do not allow a second send.
- Optimistic UI: user bubble immediately; assistant placeholder; stream tokens in; only trust persistence after `done.ok === true`.
- On stream error: mark the bubble failed + toast; never spin forever with an empty assistant.

### 1.7 Data and cache under slow networks

- Use React Query for JSON; keep sensible `staleTime`; avoid refetch storms on focus unless needed.
- Sidebar chat list: per-user localStorage cache for instant paint; DB (`GET /chats`) remains source of truth.
- Prefetch only what the next screen needs; don’t prefetch the entire markdown stack on login.
- Invalidate narrowly after mutations (`['credits']`, `['api-keys']`, `['chats']`, `['chat', id]`).
- For list/remove/update mutations, prefer `onMutate` optimistic cache updates with rollback on error when UX benefits.

### 1.8 Layout-shift test (images and late-loading media)

**What to do:** Set throttling to **Fast 3G**. Open any long or media-heavy view and scroll so lazy-loaded images (or avatars, markdown images, OG thumbnails, etc.) enter the viewport. Watch whether text and chrome jump when media finishes loading. Optionally check Performance / Lighthouse **CLS**.

**Expected behavior:**

- Images may load gradually or show a placeholder (blur, skeleton, solid color).
- When an image finishes, it must **not** push text, buttons, or neighboring layout around.
- Stable layout = good **Cumulative Layout Shift (CLS)**. Jumping content on Slow/Fast 3G is a **fail**.

**How to build it (this stack is Vite + React, not Next.js):**

Do **not** require Next.js `<Image>` — it is unavailable here. Achieve the same outcome with plain `<img>` / shared image components and CSS:

1. **Reserve space before download** — always set intrinsic dimensions: `width` + `height` attributes and/or CSS `aspect-ratio` (or a fixed box) so the browser leaves a hole for the image.
2. **Lazy-load below the fold** — `loading="lazy"` (and `decoding="async"` when appropriate) for non-critical images. Keep LCP/hero media eager if it is above the fold.
3. **Placeholders** — skeleton, low-quality blur-up, or neutral background in the reserved box until `onLoad`; avoid collapsing from `height: 0` to full size.
4. **Modern formats** — prefer WebP/AVIF (or `<picture>` with fallbacks) when you add raster assets; don’t ship huge PNGs on critical routes.
5. **Avatars / icons** — use fixed `size-*` containers (`Avatar` + fallback). Never let a late image expand a row.
6. **Markdown / chat content** — if assistant HTML/markdown can include images, style them with `max-w-full` **and** a reserved aspect box or min-height strategy so streaming content doesn’t thrash layout as images arrive.
7. **Fonts** — late webfont swaps also hurt CLS; subset/limit faces (see §1.9) and avoid huge layout-affecting font shifts where possible.
8. **Skeletons** — loading skeletons should match final layout dimensions (composer, message list, cards) so the swap to real content doesn’t jump.

**Also apply to non-image shifts:** sticky header/composer, sidebar open/close, and “Stop” ↔ “Send” should not yank the scroll position or shove message content unexpectedly.

### 1.9 Assets and rendering performance

- Follow §1.5 for JS chunking; don’t undo splits with new eager imports.
- Follow §1.8 for images and CLS.
- Load only the font weights/families you use; avoid blocking first paint with unused faces.
- No huge decorative assets on critical routes.
- Keep glass/`backdrop-filter` rules minify-safe (see `AGENTS.md` §17) so prod isn’t a surprise.
- Don’t block the main thread with huge sync parse/eval or long tasks on navigation; prefer streaming UI + incremental render + deferred heavy libs.

### 1.10 Forms, redirects, and “slow success”

- Checkout / OAuth: user may wait; show pending until `window.location` changes.
- Return URLs (`?checkout=success`): show a banner and refetch; account for webhook lag (brief retry / interval), not a stuck empty balance.
- Validation errors stay inline; auth/`401` clears session → `/login`.

### 1.11 Manual throttle checklist (agents + humans)

Use Chrome DevTools → Network → **Fast 3G** or **Slow 3G** → **Disable cache**. Optional: CPU 4× for harsher runs. Prefer **preview/deploy** for cold load.

**Blank screen (initial load)** — Slow 3G + Disable cache + hard refresh:

1. Hard reload `/login` — splash within document paint (not blank white/black); then buttons; no chat chunks on critical path.
2. OAuth return — splash again on full reload, then app; land on `/new`.
3. Hard reload `/chat/:id` — splash → shell/sidebar early if possible; skeleton → messages (never empty dead viewport).

**JS payload (main thread)** — Network → filter **JS**, sort by Size/Time (preview build):

4. Hard reload `/login` — several smaller chunks; **no** single multi‑MB entry; **no** `chat-workspace` / Mermaid on the login critical path.
5. After login → `/new` — `authenticated-layout` / `chat-workspace` (or equivalent) load as separate chunks; UI stays responsive with Suspense fallback.

**Layout shift (images / media)** — Fast 3G; scroll to lazy images if present:

6. Images/avatars load into **reserved** space; text/chrome must not jump (watch CLS). Placeholders OK; collapsing-then-expanding boxes are a fail.
7. Skeletons → real content should match dimensions (chat thread, cards, composer area).

**Dead clicks (interactions)** — on Slow 3G, click each network-triggering control and confirm instant feedback:

8. First message — Stop/pending immediately; URL changes; stream continues; no second send.
9. Follow-up message — same URL; stream OK; Stop while streaming.
10. Keys save/delete — spinner + disabled while pending; masked keys; clear errors.
11. Credits redeem / checkout — spinner + disabled instantly; inline/toast errors; no double redeem.
12. Delete chat — confirm dialog; Confirm disables/spins; navigate `/new`; list updates (optimistic or after success).

**Pass:** no blank screen; split JS; stable layout (low CLS); instant click acknowledgment; no duplicate submits; streams survive navigation.  
**Fail:** blank white/black screen; mega-bundle on login; layout jumps when images load; dead clicks; silent hangs; double POSTs; stream abort on route change.

### 1.12 Agent implementation rules (copy-friendly)

When adding pages, forms, or chat UI:

1. Ship a loading affordance for every wait (boot, auth, suspense, query, mutation, stream).
2. **Blank-screen rule:** never ship an empty `#root` with no HTML splash. On Slow 3G hard refresh, users must see splash, shell, nav, or skeleton ASAP — use `index.html` boot UI + `Suspense` fallbacks + skeletons (Vite SPA; not Next.js `loading.tsx`).
3. **JS-payload rule:** no multi‑MB single bundle on the critical path. Use `React.lazy` / dynamic `import()` for routes and heavy libs (Streamdown, Mermaid, Shiki, charts, editors). Keep `/login` eager graph tiny. Not Next.js Server Components / `next/dynamic`.
4. **Layout-shift rule:** any `<img>` / avatar / markdown image must reserve space (`width`/`height` or `aspect-ratio`), lazy-load below the fold, and use a placeholder when helpful. No Next.js `<Image>` required — prevent CLS with explicit dimensions + CSS. Skeletons must match final layout.
5. **Dead-click rule:** every network-triggering click must instantly show pending (spinner), disable the control, and/or apply optimistic UI — use React Query `isPending`, `useTransition` / `useActionState`, and `onMutate` / `useOptimistic` where appropriate.
6. Disable or transform primary actions while in flight; no multi-click submits.
7. Lazy-load heavy authenticated / chat features; keep `/login` minimal; don’t re-introduce eager imports of chat markdown into the entry.
8. Preserve in-flight SSE across lazy chat creation navigation.
9. Surface errors with toasts or inline messages; map backend `code` values from `AGENTS.md`; roll back optimistic UI on failure.
10. After relevant changes, verify with preview + throttling: blank screen, **JS Size/Time**, **layout shift / CLS**, and dead-click interactions.
11. Optimize for perceived performance first (splash, skeletons, cached sidebar, optimistic UI, image placeholders), then bytes (split, defer, trim fonts, modern image formats).

---

## 2. Keyboard navigation & accessibility (WCAG 2.1)

Build so a keyboard-only user (and a screen reader) can use the whole app. Treat this as a build constraint, not a late QA polish pass.

### 2.1 Keyboard navigation

**What they check:** Can a user navigate the entire application without a mouse? Are there visible focus states?

**How to test:** Put the mouse away. Use only **Tab** (forward), **Shift+Tab** (back), and **Enter / Space** to activate buttons or open dropdowns/menus. Cover `/login`, sidebar, composer, model picker, chat actions, settings/keys, and credits.

**Expected behavior:**

- Every interactive control is reachable in a sensible order.
- Focus is always **visible** (`focus-visible` ring / border — never `outline-hidden` / `outline-none` without a replacement ring).
- Menus, dialogs, selects, and command palettes trap/restore focus correctly (prefer Base UI / shadcn primitives; don’t reinvent).
- A **“Skip to main content”** link is the first Tab stop on authenticated shell and login. It is visually hidden until focused — that flash on first Tab is **correct**, not a bug. Do not remove it.

**How to build it (agents):**

1. **Semantic controls** — use `<button>`, `<a>` / router `Link`, `<input>`, `<textarea>`, labeled selects. Never make a clickable `<div>` / `<span>` the only affordance.
2. **Compose primitives correctly** — Base UI / shadcn `render={...}` (e.g. tooltip/dialog trigger wrapping a `Button`) so you don’t nest interactive elements (`button` inside `button`).
3. **Visible focus** — shared components (`Button`, `Input`, `SelectTrigger`, links) keep `focus-visible:ring-*` / `focus-visible:border-ring`. Custom links and chips (PDF, sources, brand home) need the same treatment.
4. **Skip link** — keep `.skip-link` targeting `#main-content` (app shell `<main>`) and `#login-main` on login. Style stays `sr-only` until `:focus`.
5. **Hover-only actions** — sidebar delete, message copy, etc. must also appear on **keyboard focus** (`focus-within` / always in tab order), not only on mouse hover.
6. **Icon-only controls** — require an accessible name: `aria-label` and/or `sr-only` text (theme toggle, scroll-to-bottom, delete chat, submit/stop).

### 2.2 Accessibility standards (WCAG 2.1)

**What they check:** Color contrast ratios, ARIA labels / names, and screen-reader compatibility.

**How to test:** Chrome DevTools → **Lighthouse** → Accessibility (aim for **100**). Optionally WAVE for missing labels and contrast. Re-check after theme/token changes in **both light and dark**.

**Expected behavior:**

- Text and UI chrome meet **WCAG AA contrast** (normal text ≥ 4.5:1; large text ≥ 3:1). Watch `text-primary`, `text-muted-foreground`, destructive badges, and button fills in **dark mode** especially.
- Forms have associated labels (`htmlFor` / `id`, or `aria-labelledby`). Errors and helper text are wired with `aria-describedby` (and `aria-invalid` when invalid).
- Landmarks exist: skip target on `<main>`, navigation labeled (`role="navigation"` + `aria-label` on the sidebar).
- Live/status UI (streaming, loading) uses appropriate `role="status"` / `aria-live` when helpful; decorative icons are `aria-hidden`.

**How to build it (agents):**

1. **Contrast when changing tokens** — if you lighten/darken `--primary` for brand text on the background, also ensure `--primary-foreground` on solid primary buttons still passes (dark mode is the usual trap). Soft `bg-destructive/10 text-destructive` badges often fail AA — prefer solid destructive + readable foreground.
2. **Name every control** — composer textarea (`aria-label="Message"`), model picker, credit badge link, sign-out, delete key (“Delete {provider} API key”), etc. Don’t rely on placeholder alone.
3. **Forms** — `FieldLabel htmlFor` + control `id`; descriptions/errors get stable ids referenced by `aria-describedby`.
4. **Don’t strip accessible names** — avoid redundant `aria-label` on elements whose visible text already is the name (e.g. brand wordmark text), but keep labels on icon-only and ambiguous controls.
5. **After UI changes** — Tab through the surface you touched; run Lighthouse Accessibility on login + one authenticated page before calling the work done.

### 2.3 Agent implementation rules (copy-friendly)

When adding or changing UI:

1. No mouse-only interactions; Tab order and **Enter/Space** must work.
2. Never ship interactive elements without a visible `:focus-visible` style.
3. No clickable non-semantic elements unless they have an equivalent keyboard path and correct role/name.
4. Keep the skip link; do not “fix” its appearance on first Tab.
5. Meet WCAG AA contrast in light **and** dark; verify primary / destructive / muted usages after token edits.
6. Labels + `aria-*` for forms, icon buttons, and status regions; no nested interactive elements.
7. Prefer existing shadcn / Base UI / AI Elements primitives for focus management over custom popovers.

---

## 3. Resize test & visual polish

Reviewers form an opinion on design sensibility **before** looking at code. Treat fluid layout, typography, spacing, and integrity as build constraints — not a late polish pass.

### 3.1 What they check

- **Fluid responsiveness** — layout reflows smoothly from full-screen down to mobile width; no horizontal scrollbars.
- **Typographic scale** — headings, body, and muted text stay readable and hierarchical at every width (no clipped or overflowing brand/type).
- **Spacing consistency** — padding/gaps follow a coherent scale (`p-4` / `sm:p-6`, etc.); pages don’t feel cramped on phone or sparse on desktop without reason.
- **Layout integrity** — no overlapping chrome, cut-off text, colliding header controls, or “visually careless” stacking.

Overlaps, truncated labels that look accidental, or a UI that only works at one desktop width are a **major red flag**.

### 3.2 How to test

1. Drag the browser window from full-screen down to ~320px width quickly — watch header, sidebar, composer, and page content reflow.
2. DevTools → **Device Toolbar** — exercise at least **iPhone SE** (~320), a modern phone (~390), and **iPad** (~768).
3. Spot-check authenticated surfaces: `/new`, `/chat/:id` (long URLs / code / sources if available), `/settings/keys`, `/credits`.
4. Confirm **no document-level horizontal scrollbar**; wide content (tables, code) may scroll **inside** its container only.

**Pass:** smooth reflow, intact header/composer, readable type, consistent spacing, no collisions.  
**Fail:** horizontal page scroll, overlapping controls, cut-off text, unreachable mobile nav, pages clipped with no vertical scroll inside the shell.

### 3.3 How to build it (agents)

1. **Mobile chrome first** — below `md`, the sidebar is a sheet. Always expose a **`SidebarTrigger` in the app header** (`md:hidden`); do not rely on `Ctrl/Cmd+B` or a trigger trapped only inside the closed sheet. Close the mobile sheet on route change.
2. **Flex/grid overflow** — give flex children `min-w-0` (and often `overflow-hidden` / `truncate`) so long titles, emails, model labels, sources, and PDF filenames shrink instead of blowing out the width.
3. **Header density** — on narrow widths, compress chrome: icon-only tabs with `aria-label`, shorter credit badge text, tighter gaps/`px`. Prefer `grid-cols-[auto_minmax(0,1fr)_auto]` (or similar) over rigid equal columns that collide.
4. **Shell scroll** — the authenticated shell uses `overflow-hidden` + `h-svh`. Every tall page (`/credits`, `/settings/keys`, usage, etc.) needs its **own** `overflow-y-auto` (and `min-h-0`) — otherwise content is clipped with no scrollbar.
5. **Chat column** — thread + sticky composer stay `max-w-3xl` / `min-w-0`; message text uses wrap (`break-words` / `overflow-wrap: anywhere`); code/tables scroll inside the message, not the viewport. Match skeleton padding to the live thread.
6. **Typography** — scale brand and page titles with breakpoints or `clamp` so they don’t overflow on SE-width screens; use `text-pretty` on multi-line supporting copy.
7. **Safety net** — `overflow-x-clip` on `html`/`body` (and `min-w-0` on `SidebarInset`) prevents accidental page-level horizontal scroll from one runaway child.
8. **After UI changes** — do the drag-resize + Device Toolbar pass on the surfaces you touched before calling the work done.

### 3.4 Agent implementation rules (copy-friendly)

When adding or changing UI:

1. Build so the first viewport and every breakpoint look intentional — not “desktop only, then hope.”
2. Never ship a mobile layout without a reachable way to open navigation.
3. No page-level horizontal scroll; constrain long strings and scroll wide media inside cards/threads.
4. Keep spacing on a consistent scale; align padding across login, empty chat, thread, keys, and credits.
5. Ensure every route inside the overflow-hidden shell can scroll its own content.
6. Compress header/actions on small screens rather than letting controls overlap or clip.
7. After layout work, verify with window drag + iPhone SE / phone / iPad device modes.

---

## 4. Architecture & code quality (structure / components)

Reviewers open the GitHub repo after visual and interaction tests. They judge whether the app looks like a maintainable frontend — not a demo dump. Criteria often say “Next.js”; **micromanus is Vite + React Router**. Score the same ideas (layers, reuse, logic vs UI), not App Router folders.

### 4.1 What they check

- **Folder structure** — easy to navigate: e.g. `components/`, `lib/`, `hooks/`, `pages/`, `providers/` (a `services/` folder is optional; thin `lib/api` + React Query hooks is enough here).
- **Reusability** — clear prop interfaces where a component is presentational; shared helpers for repeated mapping/domain updates.
- **Separation of concerns** — data fetching, domain/stream logic, and UI rendering are not all piled into one giant file.
- **No god files** — a single file of ~800+ lines that mixes fetch, state, and JSX is a red flag.
- **No premature abstraction** — over-split hook-per-file, repository classes, or DTO layers “for scale” when a simple module works get penalized too.

### 4.2 How to test (self-review)

1. Sketch the `src/` tree — can a new engineer find API, chat stream, and pages in under a minute?
2. List the largest **app-owned** files (`wc -l`). Ignore vendored `components/ui/*` and `components/ai-elements/*` size.
3. Open each large app file and ask: does it mix transport + domain state + markup? Can the non-React parts live in `lib/`?
4. Check feature components: is page chrome (title, layout wrapper) in `pages/`, with forms/lists as reusable pieces (same pattern as Credits vs Keys)?
5. Ask whether a proposed “refactor” adds ceremony without clarifying ownership — if yes, skip it.

**Pass:** clear layers; app files stay focused; business logic testable/pure where it matters; no fake architecture.  
**Fail:** 800-line page/provider mixing everything; unreadable folders; or a maze of abstractions with no benefit.

### 4.3 Target shape (this codebase)

| Layer | Owns |
| --- | --- |
| `lib/api.ts` | JSON `api()`, SSE parse, stream POST |
| `lib/chat-stream.ts` | SSE consume + pure thread message updaters |
| `lib/chat-messages.ts` | `ChatDetail` → `UiMessage[]` mapping |
| `lib/chat-list.ts` | Per-user localStorage paint cache for the chat list |
| `lib/chat-thread-store.ts` | External store for SSE / optimistic message threads |
| `hooks/use-api.ts` | React Query for JSON endpoints (including chat list) |
| `providers/chat-stream-provider.tsx` | Stream status/actions + wiring to `consumeChatSse` |
| `pages/*` | Route layout, compose forms/panels |
| `components/*` | UI (presentational thread, forms, shell) |

SSE stays **outside** React Query and **above** the `/new` → `/chat/:id` outlet (see §1.6, §5, and `AGENTS.md`).

### 4.4 How to build it (agents)

1. **Prefer extract over invent** — when a provider/page grows, pull pure helpers into `lib/` (stream event application, detail→UI mapping). Keep the provider as wiring, not a second API client.
2. **One owner for chat-list cache** — React Query `['chats', userId]` is the UI source of truth; localStorage is `placeholderData` + persistence rewritten by `useChats`. Optimistic upsert/remove must `setQueryData` (and write localStorage). Don’t keep a parallel `useState` list in the sidebar.
3. **Pages compose; forms don’t own the page shell** — titles and scroll wrappers live in `pages/` (`KeysPage`, `CreditsPage`); forms stay cards/fields only.
4. **Presentational where it pays off** — `ChatThread` takes `messages` props. Hook-bound forms (`ApiKeyForm`, composer) are fine at this size; don’t prop-drill the whole auth/query tree “for purity.”
5. **Do not add** a full `services/` layer, one file per hook, or repository/DTO stacks until `use-api.ts` or a domain module is clearly too large (~300+ and hard to navigate).
6. **Do not “fix”** AI Elements / shadcn file length — treat as vendor/registry.
7. After structural changes, run `tsc --noEmit` and a quick chat smoke (new message → navigate → stream still works).

### 4.5 Agent implementation rules (copy-friendly)

When adding features or refactoring:

1. Put new files in the existing folders; don’t invent parallel trees without a reason.
2. Keep app-owned modules focused — if fetch + domain + JSX share one file and it’s growing past a few hundred lines, extract the non-UI part to `lib/`.
3. Separate page chrome from interactive forms/lists.
4. Reuse pure mappers/updaters (`chatDetailToUiMessages`, stream helpers) instead of copying `useEffect` blobs.
5. Avoid premature abstraction: the simplest clear structure wins over “enterprise” layering.
6. Leave vendored UI registries alone; judge structure on app-owned code.
7. Preserve SSE-above-route and React Query-for-JSON boundaries from `AGENTS.md` and §5.

---

## 5. State management boundaries (client vs server)

Reviewers check whether you know what belongs in a **server cache** (TanStack Query) versus **client/UI state**. Dumping fetchable data into Redux/Zustand (or a homemade global store) is a common fail. So is over-fetching and broadcasting high-frequency updates to the whole tree.

### 5.1 What they check

- **Client versus server state** — session/UI/stream vs data that comes from the API.
- **No duplicate server caches** — avoid global stores (Redux, Zustand, or parallel `useState` + localStorage) for data React Query already owns.
- **Fetch discipline** — shared query keys, sensible `staleTime`, invalidate/set after mutations; no redundant independent fetches of the same resource.
- **Re-render discipline** — high-frequency client updates (SSE tokens) must not re-render shell/sidebar/unrelated consumers.

### 5.2 How to test (self-review)

1. Search the repo for `zustand`, `redux`, `create` from global store libs — server data should not live there.
2. For each React Query key (`me`, `models`, `api-keys`, `chats`, `credits`, `chat`), confirm the UI reads **`data` from the hook** (or `setQueryData` / invalidate), not a second mirror store.
3. Chat list: sidebar should render `useChats().data`; localStorage only as paint cache (`placeholderData`), rewritten on fetch.
4. Chat messages: confirm SSE/optimistic threads stay **outside** React Query (required for `/new` → `/chat/:id` without aborting the stream), but status/actions are separated from the message store so tokens don’t thrash the shell.
5. During a streaming reply, React DevTools / why-did-you-render: AppShell, sidebar, and credit badge should **not** re-render on every token — only the thread (and anything that intentionally subscribes to messages).
6. Spot over-fetching: opening `/new` should not spawn duplicate `GET /models` / `GET /credits` from unrelated trees beyond normal Query sharing; window focus should not hammer APIs (`refetchOnWindowFocus` defaults in `App.tsx`).

**Pass:** JSON via React Query; auth + SSE as client state; localStorage only as cache/placeholder; stream updates scoped.  
**Fail:** Redux/Zustand (or equivalent) holding `/me`, keys, credits, or chat list; sidebar `useState` mirroring the server list; context that re-renders the whole app on every SSE token.

### 5.3 Ownership map (this codebase)

| Data | Owner | Notes |
| --- | --- | --- |
| `me`, models, API keys, credits, chat detail | React Query (`hooks/use-api.ts`) | Invalidate / `setQueryData` after mutations |
| Chat list | React Query `['chats', userId]` | localStorage = `placeholderData` + persistence via `lib/chat-list.ts` |
| Supabase session / token | `AuthProvider` | Client session, not a server-entity cache |
| SSE stream status, send/stop | `ChatStreamProvider` context | `isStreaming`, `streamingChatId`, actions |
| Optimistic / streaming messages | `lib/chat-thread-store.ts` + `useChatMessages` | `useSyncExternalStore`; hydrate from `GET /chats/:id` into the store |
| Selected model, theme | `localStorage` + local component state | UI prefs, not server records |

### 5.4 How to build it (agents)

1. **Default new server reads to React Query** — add a hook in `use-api.ts` with a `queryKeys` entry; do not invent a context/store for that JSON.
2. **Mutations update the cache** — `invalidateQueries` and/or optimistic `setQueryData` + rollback; keep localStorage chat-list writes in sync when you touch the list.
3. **Keep SSE out of React Query** — hold the in-flight `fetch` and thread above the route outlet; merge `done` into UI, then invalidate credits/chats/chat detail as today.
4. **Split high-frequency state** — message tokens in an external store (or a narrow subscription); put rarely changing flags/actions in context. Never put `threads` in the same context value that AppShell/sidebar subscribe to.
5. **Do not add Redux/Zustand** for micromanus server data. A tiny external store for SSE threads is fine; a second global cache for `/credits` is not.
6. Prefer Query defaults already set in `App.tsx` (`staleTime`, `refetchOnWindowFocus: false`) over ad-hoc refetch loops.

### 5.5 Agent implementation rules (copy-friendly)

When adding data or chat behavior:

1. If it comes from a JSON endpoint → React Query. If it’s session, UI chrome, or an in-flight SSE thread → client state.
2. Never mirror React Query results into Redux/Zustand/`useState` as a second source of truth.
3. Chat list UI reads the query; localStorage is paint cache only.
4. SSE message updates must not re-render the authenticated shell/sidebar on every token.
5. Share query keys; invalidate narrowly after success; avoid duplicate fetches of the same resource.
6. Do not put provider API keys, Stripe, or LLM calls in the browser — boundaries in `AGENTS.md` still apply.

---

## Future topics

Add new top-level sections here as more QA lessons land (offline, Stripe edge cases, etc.).
