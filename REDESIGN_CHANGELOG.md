# WaterChain Redesign Changelog — Wavy Tidal Depth (Phase 2)

Base: the supplied Step 9 package (Step 8 corrected package plus
Step 9's per-investigation diagnostic cache, fingerprint
staleness, "No register flags" wording, and strict CSV checks).
No Step 9 behaviour was altered.

## Visual identity (new)

- Custom WaterChain brand mark (droplet + four linked stages)
  in the sidebar, the homepage hero, and the create-investigation
  dialog; wordmark set to "WaterChain" consistently.
- Real favicon set: `app/icon.svg`, `public/favicon.svg`, and a
  rendered `public/favicon.ico`. `/favicon.ico` previously
  returned 404; it now returns 200, and the page head carries
  `rel="icon"` links for both SVGs.
- Removed: the generic waves-icon brand tile and the sparkle
  icon in the create dialog. No Claude, framework, or template
  branding remains visible in the UI (audited: none existed in
  source beyond the generic tile and the missing favicon).

## Homepage (new)

- A homepage hero above the workspace: "Water, traced like a
  river." with an honest one-sentence pitch, "Start an
  investigation" (opens the existing create dialog) and "See
  how the pathway works" (scrolls to the pathway panel), plus
  three truthful chips (evidence before conclusions;
  abstention is a valid outcome; everything stays in this
  browser). No fake evidence, no seeded records, no invented
  metrics — the hero contains no sample data at all.

## Wavy Tidal theme

- Full recolour of `app/globals.css` to deep ocean blues
  (`#0A2E4A` → `#0D4266` gradient, `#123F66` panels,
  `#5ED3E6` accent) with 18px panel radii, realistic shadow
  falloff, and 3px stage-card top accents.
- Three slowly drifting SVG wave layers at the foot of the
  hero, and a flowing dashed wave line under the pathway
  stage cards. Both respect `prefers-reduced-motion`.
- Sidebar, topbar, stage cards, and state pills recoloured
  into the same blue family (a first pass left the sidebar
  and stage cards in their old near-black tones; a second
  pass corrected them and was re-verified by build and
  screenshot — see REDESIGN_TEST_REPORT.md).

## Information hierarchy (kept, sharpened by the theme)

- The existing order is unchanged: hero → pathway →
  inspector → register → workbench → guardrails. The theme
  gives the pathway and the conclusion panel the strongest
  elevation and accent; warnings, blockers, and stale states
  keep their Step 9 treatments and wording.

## Deliberately not done

- No new dependency (no 3D library — CSS + inline SVG only).
- No route, schema, storage, engine, or validation change.
- No seeded demo data, no new empty-state illustrations
  implying measurements, no change to abstention wording.
- No focus trap or Escape-key handling added to dialogs
  (pre-existing limitation, carried over honestly).
