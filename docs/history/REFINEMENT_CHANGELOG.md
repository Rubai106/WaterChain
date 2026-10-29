# WaterChain Refinement Changelog — Pass 2 (Light-First)

Base: the delivered Pass 1 ZIP
(`WaterChain_Step9_WavyTidal_Redesign.zip`, dark Tidal
theme). This pass refines that design; it does not restart
it and does not rebuild the application.

## 1. Light-first system (the headline change)

- Whole workspace recoloured from dark ocean (`#0A2E4A`
  background, `#123F66` panels) to a light system:
  background `#F4F8FB`, primary surfaces `#FFFFFF`,
  secondary surfaces `#EAF3F8`, primary text `#17324A`,
  secondary text `#52697D`, borders `#D8E4EC`.
- This is a full rework, not white cards on a dark shell:
  sidebar, topbar, panels, modals, tables, inputs,
  buttons, badges, diagnostic results, stale/error
  banners, and the hero were all moved into the light
  system, so navigation, canvas, and register read as one
  product.
- Deep navy `#0A2E4A` survives only as emphasis: the
  active sidebar item and selected-state accents. The
  favicon tile stays deep navy for tab readability.
- Primary brand `#147FA3` (buttons, accents, flowline);
  small brand text uses darker `#0F6B8A` for contrast.
  Teal `#2B9D98` is decorative only — it measures
  3.29:1 on white, which fails normal text, so it is
  never used as text (see DESIGN_SYSTEM.md for the full
  measured table). No dark theme was added (optional in
  the brief; a second theme would double visual QA).

## 2. Signature water pathway

- New layered ribbon behind the four stage cards on
  desktop/tablet: pale gradient band, white highlight
  edge, and a dashed brand-blue flow line animating over
  8s. Hidden on mobile, where cards stack vertically.
- Stage cards rebuilt as dimensional nodes: white
  gradient face, 3px brand top edge, layered realistic
  shadows, 3px hover lift, 4px lift + 2px brand ring when
  selected (`aria-pressed` set).
- New data-driven stage signals, computed from the
  investigation's own records and the existing per-record
  reviews: `Unassessed`, `Positive on file`,
  `Limited metadata`, `No register flags`. A legend
  under the track states plainly that a positive on
  file is an observation, not proof of origin. No stage
  is ever hardcoded as contaminated or verified, and no
  measurement, probability, or finding is invented.
- Hero waves recoloured to pale blues (`#CDE6F0`,
  `#D9ECF3`, blending into `#F4F8FB`) and the hero
  itself moved to a pale gradient with navy type, so
  the waves read as water rather than decoration on a
  dark panel.

## 3. Depth, kept restrained

- Layered pathway elements, subtle panel elevation,
  realistic shadows, small hover/selection elevation
  changes, gentle depth gradients, short purposeful
  transitions. No large droplets, no glassmorphism, no
  constant motion or rotation, no neon glow, no heavy
  blur, no parallax, no decorative charts implying
  measurements. `prefers-reduced-motion` disables wave,
  ribbon, and flowline animation and stage lift.

## 4. Workspace consistency

- The same light tokens, radius, shadow, and status
  language now cover the sidebar, status strip,
  pathway, inspector, register, workbench, guardrails,
  dialogs, and all empty / loading / error / no-result
  / stale states. Status is never colour alone: icon +
  word + count everywhere. Absence of data is never
  presented as a successful diagnosis (empty review
  still abstains; the "Causation unproven" footer is
  untouched).

## 5. Brand

- The Pass 1 droplet-plus-linked-stages mark is kept
  in shape and recoloured for light surfaces
  (stroke `#147FA3`, line `#17324A`). Full audit:
  no Claude branding, no "N" logo, no Next.js starter
  logo, no framework favicon remnants, no template
  title/description, no placeholder copy, one product
  name everywhere.

## Files changed in this pass

`app/globals.css` (light tokens, mapping, Pass 2
overrides), `app/page.tsx` (selected stage, stage
signals, ribbon SVG, light hero wave fills, pathway
legend), `components/BrandMark.tsx` (light colours),
plus the new docs in this package. Everything else is
byte-identical to the Pass 1 ZIP (verified by diff:
`lib/`, `engine/`, `app/api/diagnose/route.ts`,
`components/diagnostics/`, `components/evidence/`).
