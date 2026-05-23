# Medicare Market Intelligence

A multi-page CMS public data dashboard for hospice market analysis with AI chat, hospital/nursing home opportunity scoring, drug spending, prescribers, NPI lookup, competitor intelligence (IRS 990), and clinical trials.

## Run & Operate

- Frontend (Vite/React): `pnpm --filter @workspace/medicare-intel run dev`
- API Server (Express): `pnpm --filter @workspace/api-server run dev`
- Both are started automatically via Replit workflows

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind v4 + wouter routing + shadcn-style UI
- API: Express 5 + esbuild
- AI: Anthropic SDK + OpenAI SDK (agentic tool-calling with CMS functions)
- No database required — all data pulled live from CMS/public APIs

## Where things live

- Frontend: `artifacts/medicare-intel/src/`
  - Pages: `src/pages/` (home, national-dashboard, chat, hospice-market, hospital-opportunity, nursing-home, npi-lookup, drug-spending, prescribers, competitor-intel, clinical-trials, settings)
  - Shared components: `src/components/shared/` (nav, loading-spinner, error-banner, empty-state, page-header, state-select, data-table)
  - UI primitives: `src/components/ui/` (shadcn-style)
  - Lib: `src/lib/api.ts` (mcp() fetch), `src/lib/cms-direct.ts` (types), `src/lib/utils.ts`
- Backend: `artifacts/api-server/src/`
  - Routes: `src/routes/chat.ts` (SSE streaming), `src/routes/mcp.ts` (tool dispatcher), `src/routes/backends.ts`
  - CMS functions: `src/lib/cms-direct.ts` (all data fetching logic)

## Architecture decisions

- All CMS data is fetched live (no caching/DB) — the hospice dataset requires filtering `SMRY_CTGRY=PROVIDER` to exclude NATION/STATE summary rows
- Frontend `mcp()` calls `/api/mcp` with `{tool, args}` — the backend dispatches to the appropriate CMS function
- Chat uses SSE streaming: `data: {"text":"..."}` lines ending with `data: [DONE]`
- Badge component extended with `success` and `warning` variants for opportunity scoring
- Hospice market page requires state filter for performance (5000-row dataset)

## Product

- **National Dashboard** — hospital opportunity + hospice market overview with state filter and Census demographics
- **AI Chat** — Claude/GPT-4o agentic chat with live CMS tool calls
- **Hospice Market Share** — CMS PAC utilization ranked by market share
- **Hospital Opportunity** — Medicare inpatient DRG scoring for hospice referral opportunity
- **Nursing Home Opportunity** — CMS-rated SNFs scored by bed count and quality pressure
- **NPI Lookup** — NPPES registry search with full provider detail
- **Drug Spending** — Medicare Part D/B with FDA adverse events and drug label expansion
- **Prescribers** — Medicare Part D prescribers by drug, state, specialty
- **Competitor Intelligence** — IRS Form 990 data via ProPublica with revenue sparklines
- **Clinical Trials** — ClinicalTrials.gov v2 API with condition/status/state filters
- **Settings** — Backend status and API key requirements

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Hospice dataset at CMS UUID `4e73f1b5-82cb-4682-8ad2-28493f0b6840` includes NATION/STATE summary rows — always filter `SMRY_CTGRY=PROVIDER`
- Hospice page does NOT auto-load (too slow without state filter) — user must search
- CENSUS_API_KEY is optional; state demographics on National Dashboard silently hide when missing
- Chat SSE endpoint is at `/api/chat` on the Express server (port 8080), proxied through Vite at `/api/`
- Vite proxies `/api/` → Express server — check `vite.config.ts` if API calls fail

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
