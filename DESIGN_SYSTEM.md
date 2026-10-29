# WaterChain Design System — Light Refinement, Pass 2

Supersedes the Pass 1 (Wavy Tidal) dark system. Base application
unchanged; only `app/globals.css`, `app/page.tsx` (pathway
signals/selection, ribbon, light hero waves),
`components/BrandMark.tsx` (light-background colours), and the
docs in this package were touched. The favicon tile
(`app/icon.svg`, `public/favicon.*`) is intentionally still
deep navy so the mark reads on a browser tab.

## Brand mark

Original droplet holding four linked stage dots, unchanged in
shape. On light surfaces the stroke is `#147FA3`, the droplet
fill is `rgba(20,127,163,.10)`, the connecting line is
`#17324A`, and the dots are `#147FA3`. Wordmark "WaterChain"
with the caption "Evidence Investigation Workbench". No
Claude, framework, template, or "N" branding anywhere
(audited: layout title/description, favicon, and all copy
name WaterChain only; Lucide icons are functional UI icons,
never branding).

## Colour tokens (final, in `app/globals.css` `:root`)

| Token | Value | Use |
|---|---|---|
| `--bg` | `#F4F8FB` | Page background (warm pale blue-grey) |
| `--panel` | `#FFFFFF` | Primary surfaces / cards |
| `--panel-2` / `--cyan-soft` | `#EAF3F8` | Secondary surfaces, icon tiles, table headers |
| `--text` | `#17324A` | Primary text |
| `--muted` / `--muted-2` | `#52697D` | Secondary text |
| `--cyan` | `#147FA3` | Primary brand (buttons, accents, flowline, ribbon flow) |
| `--brand-dark` | `#0F6B8A` | Small text, links, focus rings (darker brand) |
| `--line` / `--line-soft` | `#D8E4EC` | Borders (subtle blue-grey, never bright cyan) |
| Deep navy `#0A2E4A` | accent only | Active sidebar item, selected-state emphasis |
| Teal `#2B9D98` | decorative only | Wave/dots/ribbon accents — never text (see contrast) |
| Teal-dark `#1F7A76` | — | Teal text when teal text is ever needed |
| Success `#1B7A4D` | — | "No register flags", permitted states |
| Amber text `#8A5A00` on `#FFF4D6` | — | Uncertainty / limited / stale |
| Red `#B42318` on `#FDECEA` | — | Blockers / errors |

## Measured contrast (WCAG, computed from the final hex values)

| Pair | Ratio | Verdict |
|---|---|---|
| `#17324A` on `#FFFFFF` | 13.19:1 | AAA |
| `#17324A` on `#F4F8FB` | 12.36:1 | AAA |
| `#52697D` on `#FFFFFF` | 5.71:1 | AA (normal text) |
| `#52697D` on `#F4F8FB` | 5.35:1 | AA |
| `#52697D` on `#EAF3F8` | 5.08:1 | AA |
| White on `#147FA3` (primary buttons) | 4.57:1 | AA (normal text) |
| `#0F6B8A` on `#FFFFFF` | 6.02:1 | AA — used for small brand text instead of `#147FA3` |
| `#1F7A76` on `#FFFFFF` | 5.12:1 | AA — used for small teal text instead of `#2B9D98` |
| `#1B7A4D` on `#FFFFFF` | 5.33:1 | AA |
| `#8A5A00` on `#FFFFFF` | 5.93:1 | AA |
| `#B42318` on `#FFFFFF` | 6.57:1 | AA |
| White on `#0A2E4A` (active nav) | 13.98:1 | AAA |
| `#2B9D98` on `#FFFFFF` | 3.29:1 | FAILS normal text — decorative only, never text or white-on-teal text |

Two suggested starting tokens were therefore adjusted, not
adopted blindly: `#2B9D98` is kept as a decorative accent
only, and small brand text uses `#0F6B8A` rather than
`#147FA3` where a stronger ratio is wanted. Status is never
colour alone: every badge pairs colour with an icon and a
word, and counts (`3W`, `2W`) accompany integrity badges.

## Typography

Manrope for display/headings (hero 42px, page 30px, panel
22px, tight tracking), DM Sans 13px for body/UI, DM Mono
for kickers, record codes, fingerprints, and status pills
(8–11px, letter-spaced). Google Fonts with system fallbacks;
if the font host is unreachable the app renders with
fallbacks (observed in the sandbox: font-fetch console
error only, no breakage).

## Spacing, radius, shadows (tasteful depth, not a game)

- Panel radius 16px, stage-card radius 14px, buttons 12px,
  pills 999px. Content max width 1580px, 35px side padding
  (13px mobile).
- Panels: `0 1px 2px rgba(23,50,74,.05), 0 12px 28px
  rgba(23,50,74,.07)`; pathway panel slightly deeper
  (`0 16px 32px rgba(23,50,74,.08)`) because it is the
  signature element.
- Stage cards: white face with a gentle vertical gradient
  (`#FFFFFF` → `#F7FBFD`), 3px `#147FA3` top edge,
  `0 1px 2px + 0 12px 24px rgba(23,50,74,.10)`; hover lifts
  3px (`0 18px 32px`); selected lifts 4px with a 2px
  `#147FA3` ring. No glassmorphism, no neon glow, no heavy
  blur, no parallax, no large decorative droplets.

## Signature pathway (data-driven, never invented)

- A layered SVG ribbon runs behind the four stage cards on
  desktop/tablet: a pale gradient band (`#D9ECF3` →
  `#BFE0EC`), a white highlight along its top edge, and a
  dashed `#147FA3` flow line animating over 8s. On mobile
  (≤620px) the ribbon hides and the cards stack vertically
  with rotated connectors.
- Four stage nodes share one visual language (icon tile in
  `#EAF3F8`, stage index, title, subtitle, count pill).
  Each node shows a **stage signal computed from the actual
  records on file** (same data as the register, plus the
  existing per-record review):
  - `Unassessed` (grey) — no records at the stage.
  - `Positive on file` (brand blue) — a record at the stage
    reports `detected`, or a quantified value above zero.
  - `Limited metadata` (amber) — records exist but a review
    is `blocked` or `limited`, and no positive is on file.
  - `No register flags` (green) — records exist, reviews
    clear, no positive on file.
  Priority is positive → limited → clear. The signal is a
  record observation, not a diagnosis: a legend under the
  track states that a positive on file is not proof of
  origin and that only the diagnostic review can discuss a
  candidate transition. The footer "Causal origin remains
  unproven" and the engine's abstention behaviour are
  untouched. Clicking a stage selects it (ring + lift +
  `aria-pressed`) and shows the existing notice text.
- Supporting labels remain readable at 1280px and 390px;
  the pathway track is data from the investigation, never
  seeded or hardcoded.

## Motion

- Hero waves drift (26s / 38s reversed / 52s); pathway
  ribbon flow 8s; flowline 6s; hover/transition 150–180ms.
  All animation is decorative and never moves layout.
- `prefers-reduced-motion: reduce` disables wave, ribbon,
  and flowline animation and stage hover/selection lift
  (verified in Chromium: computed animation `none`).

## States

- Empty: "No evidence to inspect" panel + "Pending" check
  rows; empty diagnostic review abstains with "No evidence
  records supplied" (never presented as a success).
- Loading: existing diagnostic spinner on a light surface.
- Error: light red panel (`#FDECEA`, `#B42318` text).
- No results: register "no results" copy on white.
- Stale: amber banner (`#FFF4D6`) + bundle export disabled.
- Integrity: pale-tinted badges (green/amber/red/grey) with
  icons, words, and counts.
- Focus: 2px `#0F6B8A` outline with 3px offset on all
  interactive elements, including stage cards.

## Layout hierarchy (unchanged order, light emphasis)

Hero → investigation identity/status strip → pathway
(signature, deepest elevation) → evidence inspector →
evidence register → diagnostic workbench → guardrails.
Sidebar 248px → 220px (≤1250px) → 68px icon rail
(≤980px); grids collapse to one column; tables scroll
horizontally at 850px minimum width. Long names, long
explanations, many findings, and large tables wrap or
scroll without breaking the layout (no fixed heights on
text containers).

## What was NOT changed

`lib/`, `engine/`, `app/api/diagnose/route.ts`,
`components/diagnostics/`, `components/evidence/`,
storage keys, cache/fingerprint logic, validation, and all
scientific rules. No dark theme was added: the brief made
it optional, and a second theme would double the visual
QA for no competition benefit — the light system is the
single, coherent theme. No seeded demo data, no new
features, no new dependencies.
