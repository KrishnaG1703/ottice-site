# Lovable prompt: Otter Vault landing page

Paste everything below the line into Lovable. Before sending, upload these files from `ottice-site/assets/` so Lovable can use them:

- `icon.png` (app icon)
- `otter3d/otter.glb` (3D otter sculpt for the hero) and `otter3d/otter-real.webp` (the finished otter render it reveals)
- `otter/idle.webm`, `otter/scan.webm`, `otter/wave.webm`, `otter/celebrate.webm` (animated otter, transparent background)
- `otter/*.webp` (still poses: idle, scan, wave, celebrate, pout, salute, laugh, lean)
- `fonts/Lumiare.otf` (display font)

---

Build a single-page marketing site for **Otter Vault**, a browser extension for developers. A friendly otter notices the moment a password or API key appears on a web page, asks permission, then saves it to an encrypted notebook on the user's device. It only fills a saved secret back on the exact website it came from.

Stack: React + Vite + TypeScript + Tailwind. No backend, no auth, no database. Everything is static and runs in the browser.

## Brand and visual style

- **Mood:** dark, calm, premium, a little playful. Think a well-made developer tool, not a crypto site. No gradients on text, no glassmorphism cards, no stock illustrations, no emoji anywhere.
- **All copy is lowercase**, including headings and buttons. Exceptions that must keep their exact case: API keys, URLs, email addresses, and code. Apply `text-transform: lowercase` on the body and a `normal-case` utility on those elements.
- **Fonts:** headings (h1, h2, the big statement and the marquee) use the uploaded **Lumiare** font, weight 400, slight negative tracking. Body uses the system UI stack. Monospace (`ui-monospace, SF Mono, Menlo`) for URLs, keys and step numbers.
- **Colors (define as CSS variables / Tailwind theme tokens):**
  - background `#05090b`, alternate section background `#081013`, card surface `#0c1518`
  - borders `rgba(226,240,234,0.09)`, stronger borders `rgba(226,240,234,0.16)`
  - text `#eef4f0`, secondary text `#c3d1cb`, muted text `#93a59e` (all pass 4.5:1 on the backgrounds)
  - brand mint `#9fe2b0` (hover `#b9ecc6`, text on mint `#07261a`), soft mint fill `rgba(159,226,176,0.12)`
  - amber for warnings `#f0c36a` with soft fill `rgba(240,195,106,0.1)`
  - the extension's own UI is light: paper `#fffdf7`, ink `#17362f`, muted `#5d6d67`, pale mint `#c9f0d3`
- **Shape:** pill buttons (fully rounded), cards 16px radius, browser mockups 24px radius, soft deep shadows (`0 30px 80px rgba(0,0,0,.45)`).
- **Icons:** one consistent outline icon set (Lucide), 1.8 stroke: lock, check, eye, hand, globe, key-round, user, shield, timer, cpu, arrow-right, triangle-alert, circle-alert.
- **Layout:** max content width 1200px, 24px side gutters (16px on phones). Generous vertical rhythm: about 136px between sections on desktop, 88px on phones.

## Page structure and exact copy

### 1. Fixed top nav
Transparent at the top; after scrolling 8px it gets a blurred dark background and a bottom border. Left: app icon + "otter vault" in Lumiare. Right: links "how it works", "the notebook", "security" (highlight the one whose section is in view) and a mint pill button "get otter" linking to the closing section. On phones hide the links, keep the logo and button.

### 2. Hero (two columns, stacks on tablets)
Left column:
- Amber pill badge with a small dot: "early preview · not for real secrets yet"
- H1 over three lines: "meet the otter / who keeps a / **secret.**" (the word "secret." in mint)
- Paragraph: "a tiny companion for your browser. it notices the moment a password or api key appears, asks permission, then tucks it into an encrypted notebook."
- Buttons: mint "get otter →" and outlined "watch how it works" (scrolls to the demo)
- Three small mint-check items: "no silent capture", "exact-site match", "no telemetry"

Right column: a **3D otter stage** (5:6 aspect, max 640px tall, 32px radius, a soft teal/mint radial glow behind it, no border).
- Render `otter.glb` with three.js (React Three Fiber is fine). The model has positions only, no normals, UVs or materials: weld vertices (`mergeVertices`), recompute normals, and give it a warm clay `MeshPhysicalMaterial` (color `#c97a3e`, roughness 0.62, sheen 1 with sheen color `#ffc38a`). Lights: warm hemisphere, warm key light from front-right, mint rim light from behind-left, faint cyan fill. ACES tone mapping, transparent canvas. Fit the model to about 2 units tall, centered.
- Idle: the otter sways left/right (about ±30°) and bobs slightly, and leans a little toward the cursor.
- **Hover reveal:** on pointer enter, the model turns to face the camera while the finished render `otter-real.webp` (the fluffy photoreal otter, transparent background, same framing) grows out of the cursor position as a soft-edged expanding circle (CSS `mask-image: radial-gradient(circle at x y, black r-8%, transparent r)` with `r` eased from 0% to 160%). The 3D canvas fades to 12% opacity behind it. On pointer leave the circle shrinks back toward where the cursor left. Keyboard focus and Enter/Space also reveal (from the center); on touch devices a tap toggles it.
- A small pill at the top center of the stage with a pulsing mint dot says "hover to meet the real otter" ("tap to meet the real otter" on touch); it fades out while revealed. Show a small spinner until the model loads. If WebGL or the model fails, just show the still render.
- Overlapping the stage's bottom-right edge, the **extension prompt**: a light paper card with the app icon, "i spotted a password." / "want me to keep it safe?", and two buttons "keep it safe" (pale mint) and "not now" (text). These buttons work: "keep it safe" → "safe and sound." / "saved only for acme.dev, encrypted on this device." with a "done" button; "not now" → "no problem." / "nothing was saved. i'll ask again next time." with "ask me again". "done" / "ask me again" restore the original prompt. On phones the prompt sits below the stage instead.

### 3. Statement band (alternate background, borders top and bottom)
- Eyebrow (mint, small, letter-spaced): "the idea is simple"
- Large Lumiare text: "security tools usually ask you to learn their language." in muted color, followed by "otter learns your moment instead." in full white.
- Two items with icons: eye "helpful enough to notice." and hand "polite enough to ask."

### 4. How it works: the live demo (the most important section)
- Eyebrow "how it works · live demo", H2 "three moments. try them yourself.", sub "a pretend console, the real flow. click through it, or let otter show you."
- Two columns. **Left:** a sticky ordered list of three steps with a left border; the active step gets a mint border, full opacity and a faint mint wash, the others sit at 50% opacity; completed steps show a check after their number. Steps are keyboard-focusable buttons.
  1. "01 · a secret appears." — "a password field, a masked api-key input, or a one-time token rendered as page text. otter recognizes the moment without saving anything."
  2. "02 · the otter asks." — "no background hoarding. no vague consent. you choose whether this exact value belongs in the notebook."
  3. "03 · it comes back here. only here." — "before filling, otter checks the exact protocol, hostname, port and credential kind. a similar-looking website is not the same website."
- **Right:** an interactive browser-window mockup with a URL pill and a small "restart" button in the window bar, a page area, the otter standing in the bottom-right corner of the page, and the extension's speech bubble growing out of the otter (light paper card, rounded except the bottom-right corner). Keep enough empty space at the bottom of the page area that the bubble never covers page content. Under the window: a live caption on the left, and on the right a small lock + "notebook · 0 secrets" counter and an outlined "play it for me" button.

Build it as a small state machine:

| state | url pill | page | otter | bubble | caption | active step |
| --- | --- | --- | --- | --- | --- | --- |
| start | `console.example.dev/settings/keys` (lock) | "api keys" / "model console · keys are shown once." with a mint "+ create key" button that has a soft pulsing ring, plus two masked rows `sk-live-••••x2Pd` and `sk-live-••••9sQe` | idle clip | hidden | "you're on the real console. make a key to begin." | 1 |
| reveal (clicked create key) | same | a "new key · shown once" card appears; a random `sk-live-` + 24 chars key types itself out; amber line "copy this key now. you won't be able to see it again." Create button disabled | scan clip | hidden | "a brand-new key appears as plain page text. otter notices, and saves nothing yet." | 1 |
| ask (1.1s later) | same | same | scan clip | "something secret just surfaced." / "keep this api key safe?" [keep it safe] [not now] | "nothing is stored until you say so." | 2 (1 done) |
| declined | same | same | lean pose | "no problem." / "nothing was saved. i'll ask again next time." [ask me again → ask] | "you said no, so the key never touched the vault." | 2 |
| saved | same | same | celebrate clip; counter becomes "notebook · 1 secret" with a small pop | "safe and sound." / "encrypted and locked to `console.example.dev`." [now visit a lookalike →] | "saved on this device, bound to one exact site." | 2 (1, 2 done) |
| lookalike | `console.examp1e.dev/deploy` in amber with a warning icon; the "1" is highlighted | "deploy settings" / "paste the api key for this project.", an empty focused "api key" field, a blue "save and deploy" button | pout pose | "hold on." / "this is `console.examp1e.dev` (highlight the 1), not `console.example.dev`. i won't fill here." [go to the real site] | "one character is different. close enough to fool a person, not otter." | 3 |
| real | `console.example.dev/deploy` (lock) | same deploy page, empty field | idle clip | "i know this place." / "fill the key saved for this exact site?" [fill securely] [not now] | "protocol, host and port match where the key was saved." | 3 |
| filled | same | field shows `sk-live-••••••••••••` + last 4 of the key in mint | salute pose | "filled for this exact site." / "and nowhere else. ever." [replay the demo → start] | "that's the whole job. notice, ask, return to the right place." | 3 (all done) |

- Clicking step 1 goes to start, step 2 runs reveal, step 3 jumps to lookalike (auto-saving a key first if none exists). "restart" returns to start.
- "play it for me" toggles to "stop" and walks the flow automatically: start → reveal (0.9s) → saved (+2.6s) → lookalike (+2.6s) → real (+3.2s) → filled (+2.4s), then resets the button. Any manual click stops autoplay. Keep autoplay timers separate from the per-state timers so a state change never cancels the autoplay schedule.
- The bubble uses `aria-live="polite"`. All bubble buttons are real `<button>` elements.

### 5. The notebook (alternate background, two columns)
- Left: eyebrow "the notebook", H2 "your keys and logins, held a little closer.", paragraph "not a spreadsheet of secrets. a calm, compact notebook that shows just enough, and keeps the sensitive parts encrypted.", outline chips with icons "encrypted metadata", "exact-site binding", "locks after 5, 15 or 30 min", and an italic muted line "no security theater. no noisy dashboard."
- Right: a light paper panel imitating the extension popup. Header: app icon, "my notebook", a green dot + "unlocked · auto-lock 15 min", and a "lock now" text button. A segmented tab control "all 4 · logins 2 · api keys 2" that really filters the list (arrow keys move between tabs). Four white rows with a pale-mint icon tile, a title, a small subtitle and a masked value:
  - user icon · "acme workspace" · `you@example.com · acme.dev` · dots
  - key icon · "model production key" · `API key · console.example.dev` · `sk-••••7Q`
  - user icon · "design account" · `design@example.com · figma.example` · dots
  - key icon · "staging worker" · `API key · cloud.example.com` · `nb_••••x2`
  Only logins and API keys exist in the product. Do not add recovery codes, notes, cards or biometrics.

### 6. Security, honestly
- Eyebrow "security, honestly", H2 over two lines "playful is the interface. / careful is the architecture.", sub "otter makes security approachable without making impossible promises. here's what exists in the browser build today, and what doesn't yet."
- Four cards in a row (two per row on tablets, one on phones). Each has an icon tile and a small tag:
  - lock · **built** · "authenticated encryption" — "aes-256-gcm protects the whole credential, label, site and username included, before it touches browser storage. the key comes from your passphrase through 600,000 rounds of pbkdf2."
  - shield · **built** · "strict request boundaries" — "save and fill requests are checked against the browser's own record of which page sent them, and matched to the exact origin. a page can't claim to be somewhere it isn't."
  - timer · **built** · "short-lived unlock sessions" — "you pick an inactivity window of 5, 15 or 30 minutes. closing the browser clears the unlocked session entirely."
  - cpu · **next** (dashed border, no fill) · "hardware-backed key custody" — "secure enclave and tpm integration are the production direction. it's on the roadmap, not a claim about today."
- An amber callout below: warning icon, **"this is a development preview."** "it hasn't had an independent security audit. don't store cryptocurrency seeds, production api keys or valuable credentials yet." and a mint link "read the privacy policy →" to `https://krishnag1703.github.io/ottice-privacy/`.
- Then a full-width, slowly scrolling marquee between hairlines, in Lumiare: "ask first • lock it down • match the site •" repeated (mint dots as separators). It stops when reduced motion is on.

### 7. Closing
Centered: the otter `salute` pose, eyebrow "a smaller kind of security tool", H2 "otter doesn't want to become your whole browser.", sub "it wants to show up at the right moment, do one important thing well, then float quietly back into the corner." Buttons: a disabled-looking mint-tinted pill "chrome web store · coming soon" (`aria-disabled`) and an outlined "email me when it's live" (`mailto:krishna091718@gmail.com?subject=otter vault launch`). Below, small outline pills: "chrome — in review" (mint), "edge — next", "firefox — next", "safari — later".

### 8. Footer
Logo + "otter vault", muted "your secrets, kept close. development preview.", and links "privacy" (the policy URL above) and "contact" (mailto).

## The otter
- Animated clips are transparent video. Play them muted, looping, inline, with the matching `.webp` as the poster. Safari can't show alpha in WebM, so on Safari show the still `.webp` pose instead of the clip (or use HEVC-with-alpha `.mov` files if provided).
- Load the demo otter clips only when the demo is near the viewport.
- With `prefers-reduced-motion`, always show still poses and skip all autoplaying motion.

## Motion
Subtle and meaningful only: 150–320ms ease-out transitions, bubbles scale in slightly from their corner, cards lift 2px on hover, sections fade up 18px once as they enter the viewport. No parallax, no scroll-jacking, no cursor effects.

## Accessibility and quality bar
- "skip to content" link, one h1, sequential headings, visible 2px mint focus rings, every interactive target at least 44px tall on touch.
- Decorative mockups are `aria-hidden` except the interactive parts; the demo steps and tabs are keyboard operable.
- No horizontal scrolling at 375px: grid children need `min-width: 0` so long URLs truncate with an ellipsis instead of widening the layout.
- On phones the hero prompt sits below the sign-in window instead of overlapping it, and the demo's otter shrinks and sits beside the bubble.
- Title: "otter vault — the otter who keeps a secret"; meta description: "Otter Vault is a small browser companion that notices passwords and API keys, asks first, then keeps them in an encrypted notebook on your device."

## Honesty rules for all copy
Never claim the product is audited, production-ready, synced across devices, biometric, or available in any store yet. It saves logins and API keys only, stores everything locally, and has no servers, accounts, analytics or tracking.
