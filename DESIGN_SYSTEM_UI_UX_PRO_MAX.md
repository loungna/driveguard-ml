# DriveGuard / Design System — UI UX Pro Max informed

**Reference:** nextlevelbuilder/ui-ux-pro-max-skill, MIT License, https://github.com/nextlevelbuilder/ui-ux-pro-max-skill

This is an original DriveGuard implementation informed by the repository's analytics dashboard, SaaS, accessibility, content hierarchy, anti-pattern, and responsive design guidelines. It is **not** a copied site/theme/template.

## Product intent

- Primary: Evaluate CrystalDiskInfo TXT safely, inspect SMART, optionally score supported HDD when sufficient daily observations exist.
- Secondary: Backblaze-formatted CSV classification and transparent research results (v1–v4).
- Persona: Graduate research audience + non-expert computer users.

## Visual system

- Navigation: persistent dark sidebar on desktop, accessible mobile drawer.
- Color: deep navy `#0c172c`, teal `#087f77`, neutral canvas `#f5f7fb`; semantic warning amber, never use color alone.
- Typography: Noto Sans Thai and DM Sans; hierarchy text 10 / 11 / 12 / 15 / 22 / 32px responsive.
- Layout: consistent spacing scale, 12–16px radius, neutral cards, data-first hierarchy.
- Chart: switchable Recall / Precision / MCC / False Positives; same cohort only; explanatory footnotes.
- A11y: focus visible, native buttons and labels, textual status, `aria-pressed` on metric tabs, touch targets approx >=44px, `prefers-reduced-motion`.
- Model abstention: no implied probability if model unseen, SSD/NVMe, or missing 8 consecutive daily readings.

## Anti-patterns deliberately avoided

- AI-gradient landing page with no data or call to action
- Contradictory claims that v4 wins every metric (v3 has higher precision/MCC and fewer FP)
- Displaying unknown/unsupported device as “healthy” merely because no ML score exists
- Showing 0% risk for rejected inputs
- Comparing v1's different Test cohort as if same population
- Auto-saving upload files or exposing users' actual CrystalDiskInfo serials in examples
