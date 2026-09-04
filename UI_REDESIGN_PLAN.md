# AegisFire Web UI Redesign Plan

**Status:** implemented and verified on 2026-09-04  
**Primary surface:** web application  
**Design objective:** turn the existing feature-rich dashboard into a legible, operator-first intelligence workspace without removing analytical capability or evidence attribution.

## 1. Audit summary

The September 2026 interface audit covered the Overview and Discover workspaces at the default desktop viewport and Overview at 390 × 844 px.

### What is working

- The central geospatial workflow is already functional: thermal markers, grid overlay, satellite imagery, land-cover context, facility layers, and source attribution are present.
- The application exposes a substantial end-to-end workflow: triage, facility monitoring, historical playback, unknown-source discovery, source readiness, temporal analytics, analyst validation, and model governance.
- Warning language correctly treats classifications as evidence-backed candidates instead of confirmed incidents.

### Structural problems to solve

- Nine equally weighted tabs are compressed into one top navigation strip, making grouping and wayfinding difficult.
- The same four large KPI cards appear above every workspace, even where they are unrelated to the current task.
- Nearly every panel uses the same border, tone, label scale, and density. This flattens hierarchy and makes the interface feel like a generic card dashboard.
- Search, advanced filters, brief generation, data-source state, notifications, and navigation compete within the same horizontal band.
- Mobile stacks large metric cards before the primary map and introduces several horizontal scrolling regions, delaying the core task.
- Tiny uppercase labels and low-contrast secondary text are used too broadly, creating readability and accessibility risks.
- The dark-only palette is embedded across both CSS and component utility classes, preventing a coherent light theme.

## 2. New information architecture

The primary navigation is reorganized into three operator mental models:

| Group | Workspaces | User intent |
| --- | --- | --- |
| Operate | Overview, Events, Monitor | Understand current conditions and act on review queues |
| Investigate | Playback, Discover, Analytics | Reconstruct history, find persistent unknowns, and analyze patterns |
| Govern | Validate, Models, Sources | Record human decisions, inspect model readiness, and verify provenance |

Desktop uses a persistent mission rail. Tablet and mobile use a grouped drawer opened from the command bar. The active workspace is communicated through location, color, icon, and text rather than color alone.

## 3. Workspace hierarchy

Every workspace follows the same four-level hierarchy:

1. **Global shell:** brand, grouped navigation, operator context, source status, and theme.
2. **Command bar:** current workspace breadcrumb, search where relevant, notifications, and account context.
3. **Workspace header:** task-specific title, concise explanation, and only relevant actions.
4. **Working surface:** the map, queue, evidence, charts, tables, or governance controls.

The four current-situation metrics become a compact **Mission pulse** strip shown only on Overview. Other workspaces keep their own task-specific summaries.

## 4. Visual system

### Design character

- Operational and spatial, with a restrained command-system feel rather than a generic SaaS card grid.
- Large working surfaces, quiet supporting chrome, and strong emphasis on the selected object and current task.
- Orange remains the AegisFire action/thermal accent; cyan is used for geospatial/source state; violet is reserved for discovery/model reasoning; green communicates healthy corroboration.

### Semantic tokens

Both themes use the same semantic roles: canvas, elevated canvas, surface, raised surface, border, strong border, primary text, secondary text, muted text, thermal accent, geospatial accent, success, warning, and shadow.

- **Dark:** near-black blue canvas, graphite panels, cool off-white text, restrained cyan/orange accents.
- **Light:** mineral-white canvas, white/blue-gray panels, dark navy text, darker accessible accents, and softer spatial shadows.

### Type and spacing

- Geist Sans is the primary interface face; Geist Mono is reserved for identifiers, coordinates, versions, and numeric telemetry.
- Sentence case is the default. Uppercase is limited to short metadata labels.
- Core controls target at least 36 px on desktop and 42 px on compact touch layouts.
- An 8 px spacing rhythm governs shell and panel layout, with deliberate 12/16/24 px grouping.

## 5. Theme behavior

- A labeled dark/light switch lives in the global command bar and in the mobile-accessible shell.
- The preference is stored in `localStorage` under `aegisfire-theme`.
- First visit follows the operating-system color preference; subsequent visits restore the explicit choice.
- `color-scheme` and semantic CSS variables update native controls, scrollbars, surfaces, borders, and text.
- Satellite imagery remains imagery in both modes; surrounding controls and overlays adopt the selected theme.

## 6. Responsive behavior

- At desktop widths, the navigation rail remains visible and the Overview keeps queue, map, and evidence in one task-oriented canvas.
- At tablet widths, the rail becomes a drawer and the evidence panel is available as an overlay.
- At mobile widths, pulse metrics become a compact two-column strip, map controls use icon-first targets, and navigation is grouped vertically.
- The map appears sooner in the reading order than in the old interface; nonessential page actions collapse before core controls.

## 7. Acceptance criteria

- All nine existing workspaces remain reachable and functional.
- Desktop navigation visibly groups workspaces into Operate, Investigate, and Govern.
- The global KPI slab is absent from non-Overview workspaces.
- Light and dark themes both render legibly and the choice persists across reloads.
- The theme control has an accessible name and visible focus state.
- The Overview retains grid, satellite, land-cover, facilities, sources, map selection, queue filters, and evidence detail behavior.
- The responsive layout works at 390 px without page-level horizontal overflow.
- Frontend lint and production build pass.
- Browser QA covers desktop dark, desktop light, mobile navigation, and persisted theme state.

## 8. Follow-on refinements

- Split the monolithic command-center component into workspace modules after the new shell stabilizes.
- Add URL-addressable workspace and selection state so investigations can be shared directly.
- Add keyboard shortcuts and a command palette for high-frequency analyst navigation.
- Run a formal keyboard/screen-reader test pass; the current visual audit can identify risks but cannot establish WCAG conformance.
