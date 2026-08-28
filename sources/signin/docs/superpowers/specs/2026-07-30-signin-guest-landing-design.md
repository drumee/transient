# Guest landing page for anonymous users (`signin_guest`)

Date: 2026-07-30
Figma: [Guest Landing Page (Viral) Restricted](https://www.figma.com/design/g5V3PjhNMf5bHlsHMvV17w/Drumee?node-id=1602-76946) — node `1602:76946`

## Purpose

A full-page conversion screen for an anonymous visitor: the workspace they landed on is
shown as a redacted (blurred) file grid and chat panel behind a centred "Content
Restricted" card, with a sticky bottom banner pitching signup.

## Scope decisions

- **Self-contained.** The widget lives entirely in the `signin` plugin. It makes no API
  calls and holds no share state. Visual duplication with ui-team's `dmz_sharebox` (which
  renders the same Figma page family for real share recipients) is accepted.
- **No ui-team changes.** `dmz_sharebox`, its nav/header/footer skeletons and the share
  flow are untouched.
- **Decorative content stays decorative.** The file grid and chat messages are blurred
  placeholders — `aria-hidden`, non-interactive, and the chat input is a static div, never
  a `Skeletons.Entry`, so a visitor can never type into a fake box.

## Entry points

Two, both reaching the same widget:

1. `#/plugins?name=signin&kind=signin_guest` — the generic plugins module feeds any
   registered kind, so registering `signin_guest` in `src/seeds.js` makes the page
   directly addressable with no host changes.
2. `#/welcome/signin?view=guest` — `signin_router.onDomRefresh` checks the hash query
   ahead of its OAuth/OTP branches (same parsing style as `_oauthMfaParams()`) and feeds
   `signin_guest` instead of `signin_form`.

## Structure

```
src/widgets/guest/
  index.js                    class signin_guest extends LetcBox
  skeleton/index.js           page assembly (nav + body + banner)
  skeleton/top-nav.js
  skeleton/header.js
  skeleton/split-view.js      redacted file grid + chat panel + restricted card
  skeleton/banner.js
  skin/index.scss             + _nav / _header / _split / _banner partials
  assets/*.svg                12 exported Figma glyphs
```

Class prefix is `signin-guest__*` (`fig.family`); the root element also carries
`signin__ui`, which has no global styling, so nothing from `signin-form` leaks in.

## Layout

Root `.signin-guest__ui` → `__page` (column, `min-height:100vh`, `#f2f2f7`).

- **`__nav`** — sticky top, `backdrop-filter: blur(12px)`, inner max-width 1440, px32/py16.
  Sprite mark + "drumee" wordmark (26px, 32px tall) · Product / Features / Pricing
  (SemiBold 14/20, `#0b0a21`, gap 32) · Login text button + Join Workspace pill
  (`#433cc5`, radius 4, px24/py6).
- **`__header`** — px32/py24, space-between. Left: 40×40 tile `rgba(214,95,89,.2)` radius 8
  + folder glyph, title SemiBold 24/1.1, subline lock + "Restricted Guest Access" 14/1.4.
  Right: breadcrumb pill (white, radius 6, blur 6, px16/py8, gap 16) — parent `#aeaeb2`,
  `/`, current `#d65f59`, all 12 SemiBold.
- **`__split`** — inner max-width 1440, px32, pb96, `flex:1`.
  - **`__files`** (flex 1, left corners radius 8, `position:relative`): window bar 56px
    `rgba(0,0,0,.05)` with three 12px `#aeaeb2` dots + grid/list glyphs; then `__grid` —
    4 columns, gap 32, p32, `filter:blur(6px); opacity:.4`, 8 tiles of `#d1d1d6` radius 8
    (row 1 holding folder/file/image glyphs) each with a 12px `rgba(200,196,215,.2)`
    radius-12 label bar at 122/92/138/92px.
  - **`__card`** — absolutely centred over `__files`, 40px above true centre per Figma:
    white, radius 12, p33, `0 25px 50px -12px rgba(0,0,0,.25)`, eye-slash glyph, "Content
    Restricted" SemiBold 20/1.1, two centred lines 14/1.4 `#84848c`, max-width 384.
  - **`__chat`** (362px, right corners radius 8, `0 1px 11px rgba(0,0,0,.13)`, border-left
    `rgba(0,0,0,.05)`): "TEAM CHAT" monospace SemiBold 10, `letter-spacing:.4px`, uppercase;
    message stack `filter:blur(8px)` — outgoing `#d65f59` bubble (`16px 0 16px 16px`),
    incoming white bubble (`0 16px 16px 16px`) with a "Sarah K." label and a `#d65f59`
    underlined filename, plus an 8px system pill; then the **unblurred** input row: white
    box radius 8, paperclip + "Type a message…" 10px `#aeaeb2` + send glyph.
- **`__banner`** — sticky bottom, p40. Bar: `linear-gradient(to right,#6c5ce7 0,#6c5ce7 50%,#2900a0 100%)`,
  border `rgba(255,255,255,.05)`, radius 12, px32/py17. Left: 40×40 `rgba(0,0,0,.2)` tile +
  lightning + "Shared via Drumee — Get your own workspace →" SemiBold 18/24 white. Right:
  "Join 2,000+ creators curating their best work." 14/20 + white pill h40 px24 "Sign Up
  Free" `#433cc5`.

### Deliberate deviations from the frame

- Figma positions the split absolutely (top 173, h 851) with a fixed 736px chat panel. We
  use flow layout with both panels sharing the split's height, so the page works at any
  viewport height. Pixel-equivalent at 1440×1024.
- Row-1 grid tiles get `aspect-ratio:1` like row 2 (Figma's row 1 is ~16px shorter). The
  region is blurred at 40% opacity, so the difference is not perceptible.

## Responsive

| Width | Behaviour |
|---|---|
| ≥1200px | Full frame |
| 1024–1199px | Grid to 3 columns |
| <1024px | Chat panel dropped, grid to 2 columns, nav links hidden (logo + Login + Join remain), header stacks, banner stacks headline over subline + CTA |
| <600px | Tighter padding, smaller title, full-width CTA |

Media queries drive this, with `[data-device="mobile"]` kept as a secondary hook mirroring
the existing signin skins.

## Behaviour

`signin_guest extends LetcBox`. `initialize` requires the skin, `declareHandlers()`,
`mset({flow:_a.y})` and extends `LOCALE` the way `signin_router` does. `onDomRefresh` feeds
the skeleton. `onUiEvent` handles exactly two services, owned by the widget itself so both
entry points behave identically:

| Service | Action |
|---|---|
| `go-login` | `location.hash = '#/welcome/signin'` + reload |
| `open-signup` | `location.hash = '#/welcome/signup'` + reload |

Product / Features / Pricing are plain `href` boxes with `target=_blank` →
`https://drumee.com/`, no service — the same constant ui-team's `top-nav.js` uses.

### Header copy

From widget options, with localized fallbacks and no API calls:

| Option | Renders | Fallback |
|---|---|---|
| `title` | "Restricted Project: {title}" | `GUEST_RESTRICTED_TITLE` — "Restricted workspace" |
| `parent_name` | breadcrumb left segment | `GUEST_BREADCRUMB_PARENT` — "Workspace" |
| `current_name` | breadcrumb right segment (red) | `GUEST_BREADCRUMB_CURRENT` — "Private content" |

## Assets

The four glyphs that carry brand or meaning come from the icon sprite via
`Skeletons.Button.Svg`, so they track the rest of the app:

| Element | `ico` | Tinting |
|---|---|---|
| `__nav-logo-ico` (+ a "drumee" wordmark) | `logo-upload` | none — keeps the sprite's baked `#b251fb`, so the mark matches every other Drumee logo. Not the frame's `#433cc5`. |
| `__header-tile-ico` | `folder-header` | `color: #d65f59` (the glyph paints with `currentColor`) |
| `__card-ico` | `app-eye-off` | `svg path { fill: #d65f59 }` — the glyph bakes `fill="black"`, which `color` cannot override |
| `__banner-tile-ico` | `app-lightning` | none — already ships `fill="white"`, which is what the purple tile wants |

The remaining eight glyphs (lock, grid/list toggles, the three tile glyphs, paperclip, send)
have no clear sprite equivalent, so they are exported from Figma, committed under
`src/widgets/guest/assets/`, and referenced from SCSS as `background-image` — the project's
`url-loader` rule inlines `.svg` as a data URI. Fills are baked in by the export and match
the design tokens. Six of the eight sit inside the blurred decoration, where the exact glyph
is not perceptible anyway.

## i18n

New keys in `src/locale/en.json`, with English placeholders in `fr/es/ru/zh/km` — matching
how the existing `EMAIL_NOT_VERIFIED_*` / `VERIFY_EMAIL` keys are carried. A translation
pass is a follow-up.

The blurred sample chat messages are not localized: they are decoration, blurred past
legibility.

## Verification

No test runner in this repo. Verification is:

1. Standalone `sass` compile of the new skin — catches SCSS errors without a full build.
2. Headless chromium render of the page markup at 1440×1024 and 390×844, compared against
   the Figma screenshot.

## Out of scope

Share/API integration, `dmz_sharebox` or any other ui-team change, real file or chat data,
and the access-request flow.

## Known trade-off

The nav, header and conversion banner now exist twice — here and in ui-team's
`dmz_sharebox`. That is the cost of the self-contained choice. If this page ever needs real
share data, the right move then is to converge on `dmz_sharebox` rather than grow this
widget.
