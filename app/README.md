# AI Lead Qualification App – Home Services (HVAC)

An AI-powered lead qualification chatbot and CRM dashboard for home services businesses.

## Features

**Customer-facing chat (`/`)**
- Conversational AI (Claude) qualifies leads naturally
- Service type quick-select chips (AC Repair, Heating, Install, Tune-Up, Plumbing, Electrical)
- Collects: service type, urgency, property info, contact details, ZIP code
- Detects emergencies and prioritizes appropriately
- Submits qualified lead automatically to the CRM

**Admin dashboard (`/admin.html`)**
- Live lead feed with auto-refresh every 30 seconds
- AI-generated lead scores (1–100) and tiers: 🔥 Hot / ☀️ Warm / ❄️ Cold
- Estimated job value (e.g. "$2,000–5,000")
- Follow-up priority: Immediate / Today / This Week
- Filter by tier, status, or free-text search
- One-click status updates (New → Contacted → Scheduled → Won / Lost)
- Export filtered leads to CSV
- Stats bar: total, hot, immediate, and today's leads

## Setup

1. Copy the env file and add your API key:
   ```bash
   cp .env.example .env
   # Edit .env and set ANTHROPIC_API_KEY=sk-ant-...
   ```

2. Run the server (no npm install needed — zero dependencies):
   ```bash
   node src/server.js
   # or for auto-reload during development:
   node --watch src/server.js
   ```

3. Open the app:
   - **Lead form**: http://localhost:3000
   - **Admin dashboard**: http://localhost:3000/admin.html

## Architecture

```
app/
├── src/
│   └── server.js        # Node.js HTTP server (zero dependencies)
├── public/
│   ├── index.html       # Customer chat UI
│   └── admin.html       # Admin CRM dashboard
├── data/
│   └── leads.json       # JSON file storage (auto-created)
├── .env.example
└── package.json
```

- **Backend**: Plain Node.js (`http`, `https`, `fs`, `crypto` — no npm packages)
- **AI**: Anthropic Messages API called directly via `https` module
- **Model**: `claude-sonnet-4-6` for both conversation and lead scoring
- **Storage**: JSON file (`data/leads.json`) — swap for a database as you scale
- **Frontend**: Vanilla HTML/CSS/JS — no build step, no frameworks

## Customization

Edit `QUALIFICATION_SYSTEM` in `src/server.js` to:
- Change the business name and services offered
- Adjust which questions are asked
- Modify lead data fields collected

Edit `SCORING_SYSTEM` to adjust scoring criteria and tier thresholds.
