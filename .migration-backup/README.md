# Medicare Master

A unified Medicare market intelligence platform combining the best of three repos:

- **chatgptmcpmedicare** — Next.js 15 frontend with multi-page feature routing
- **medicare-mcp** — TypeScript MCP server data endpoints (drug spending, prescribers, hospitals)
- **medicare-market-intelligence** — National dashboard, Supabase integration, OpenAI support

## Features

| Page | Description |
|------|-------------|
| Home Dashboard | Full feature overview |
| National Dashboard | Side-by-side hospital + hospice overview by state |
| AI Chat | Claude / GPT-4o / Local MCP — switch backends inline |
| Hospice Market Share | Ranked providers by market share, any state |
| Hospital Opportunity | Scored by hospice referral potential |
| Nursing Home Opportunity | SNF opportunity rankings by state/city |
| NPI Provider Lookup | NPPES NPI registry search |
| Drug Spending | Medicare Part D & Part B spending trends |
| Prescriber Data | Part D prescribers by drug/state/specialty |
| Settings | Backend status and configuration guide |

## Quick start

```bash
npm install
cp .env.example .env.local
# Edit .env.local — add at minimum ANTHROPIC_API_KEY
npm run dev
```

## AI Chat backends

The chat page has a backend selector in the input bar:

| Backend | Env vars needed |
|---------|----------------|
| Claude (Anthropic) | `ANTHROPIC_API_KEY` |
| GPT-4o (OpenAI) | `OPENAI_API_KEY` + `CMS_MEDICARE_MCP_URL` |
| Local MCP Server | `LOCAL_MCP_URL` (run medicare-mcp locally) |

All data pages pull from CMS public APIs — no API key required.

## Local TypeScript MCP server

```bash
cd ~/medicare-mcp
npm install && npm run build
USE_HTTP=true npm run start   # starts on port 3001
```

Add `LOCAL_MCP_URL=http://localhost:3001` to `.env.local`.

## Data sources

- `data.cms.gov` — Medicare utilization, drug spending, prescribers
- `data.cms.gov/provider-data` — Hospital quality, nursing homes
- `npiregistry.cms.hhs.gov` — NPPES NPI registry

No PHI. No patient-level data. Compliant public data only.
