---
name: portal-project-labels
description: Customer portal must never label projects/sites using raw SCA WEB fields (ciudad, nombre_cliente1, estacion). Leaks upstream names like "Chiconamel" to clients.
type: constraint
---
In the client-facing Customer Portal, any "Project" / "Site" grouping or label MUST be derived from the placa → plant_item → project mapping (`lookups.placaToProject` + `projectsAll`).

NEVER fall back to `t.ciudad`, `t.nombre_cliente1`, or `t.estacion` when no project mapping exists. These are upstream SCA WEB delivery fields and leak third-party names (e.g. "Chiconamel", a Mexican town) into the customer portal.

If a placa has no mapped Project: omit the row entirely. The user prefers no name over a wrong/leaked name.

Applies to (at minimum): Top Projects donut/list (donutData), EmissionsTab siteBreakdown, any future per-project ranking, charts, or PDF exports rendered inside `src/pages/CustomerPortal.tsx`.

Admin-only pages (Transactions, DeliveryDocket, TagDeliveries, CustomerDetail, DriverPortal) may still show ciudad/nombre_cliente1 — those are staff views of raw delivery data.

**Why:** User correction, repeated. Clients seeing unrelated city/customer names destroys trust in the dashboard.
