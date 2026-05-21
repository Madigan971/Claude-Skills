# Make.com Setup Guide

This guide explains how to wire Valley Chevrolet's AI receptionist into Make.com automation scenarios. Three importable blueprints are included in `assets/blueprints/`.

## Architecture Overview

```
Inbound Message
  (web chat webhook / email / voice transcript)
         │
         ▼
  Make Scenario 1: "VC Receptionist — Inbound Router"
         │   ├─ Calls Claude API with receptionist skill
         │   └─ Parses structured output (APPOINTMENT_DATA / ESCALATION_DATA)
         │
         ├─── APPOINTMENT_DATA ──▶ Scenario 2: "VC Book Appointment"
         │                              ├─ Create Google Calendar event
         │                              └─ Send confirmation email to customer
         │
         └─── ESCALATION_DATA ───▶ Scenario 3: "VC Escalation Notifier"
                                        └─ Send email to service advisor
                                           with lead/escalation summary
```

## Prerequisites

Before importing blueprints, create these connections in Make.com:

| Connection | Used For |
|-----------|----------|
| **Anthropic / HTTP** | Call Claude API |
| **Google Calendar** | Create appointment events |
| **Gmail** (or SMTP) | Send confirmation + advisor emails |
| **Webhooks** | Receive web chat / form submissions |
| **Email (Mailhook)** | Receive inbound service emails |

---

## Blueprint 1: `vc-inbound-router.json`

**Trigger:** Custom Webhook (`POST /vc-chat`)  
**What it does:**
1. Receives `{ "channel": "web|email|voice", "message": "...", "sender_email": "...", "thread_id": "..." }`
2. Calls Claude API with the Valley Chevrolet receptionist system prompt
3. Returns AI response text to the caller (for web chat)
4. Parses for `APPOINTMENT_DATA` block → passes to Scenario 2
5. Parses for `ESCALATION_DATA` block → passes to Scenario 3

**Key variables to set:**
- `ANTHROPIC_API_KEY` — your Anthropic API key
- `SKILL_SYSTEM_PROMPT` — paste the contents of `SKILL.md`

---

## Blueprint 2: `vc-appointment-booking.json`

**Trigger:** Webhook from Scenario 1 (or standalone)  
**Input:** `APPOINTMENT_DATA` JSON object  
**What it does:**
1. Creates a Google Calendar event in the service calendar
   - Title: `[SERVICE] – CustomerName – Year Make Model`
   - Start/End: derived from `preferred_date` + `preferred_time`
   - Description: full appointment details
2. Sends a confirmation email to the customer
3. Sends an internal notification email to the service desk

**Key variables to set:**
- `SERVICE_CALENDAR_ID` — Google Calendar ID for the service department
- `SERVICE_DESK_EMAIL` — email address for the service desk
- `FROM_EMAIL` — your dealership email address

---

## Blueprint 3: `vc-escalation-notifier.json`

**Trigger:** Webhook from Scenario 1 (or standalone)  
**Input:** `ESCALATION_DATA` JSON object  
**What it does:**
1. Sends a formatted email to the assigned service advisor
   - Includes: customer contact info, vehicle, reason for escalation, summary
   - Subject line: `[URGENT] Escalation – Reason – CustomerName`
2. Logs the lead to a Google Sheet (optional module, disable if not needed)

**Key variables to set:**
- `ADVISOR_EMAIL` — service advisor(s) to notify; use comma-separated for multiple
- `ESCALATION_SHEET_ID` — Google Sheets ID for lead log (optional)

---

## Web Chat Integration

To embed a chat widget on the dealership website:

1. Deploy a simple HTML/JS chat widget that POSTs to the Make webhook URL
2. Or use a third-party widget (Crisp, Tidio, Intercom) with a Make webhook trigger
3. Pass `{ "message": userMessage, "channel": "web", "thread_id": sessionId }` on each message
4. Display the `response` field from Make's webhook response

## Email Integration

1. In Make, create a **Mailhook** module as the Scenario 1 trigger instead of the webhook
2. The Mailhook gives you a unique `@hook.make.com` address
3. Set up email forwarding: inbound service emails → Mailhook address
4. The AI reply is sent back via Gmail/SMTP to the original sender

## Voice Integration

For phone/voice, use **Twilio** or **Vapi.ai** as the voice layer:
1. Twilio receives the call and converts speech to text
2. POST the transcript to the Make webhook (Scenario 1)
3. Make returns the AI response text
4. Twilio converts response text back to speech (TTS)

Alternatively, **Vapi.ai** handles the full voice stack and natively supports Claude — configure it with the Valley Chevrolet system prompt directly.

---

## Claude API Call (HTTP Module Configuration)

```
URL:     https://api.anthropic.com/v1/messages
Method:  POST
Headers:
  x-api-key:        {{ANTHROPIC_API_KEY}}
  anthropic-version: 2023-06-01
  content-type:     application/json

Body (JSON):
{
  "model": "claude-sonnet-4-6",
  "max_tokens": 1024,
  "system": "<paste SKILL.md content here>",
  "messages": [
    {"role": "user", "content": "{{1.message}}"}
  ]
}
```

Parse the response: `{{body.content[0].text}}`

---

## Testing

1. Import all three blueprints
2. Set all required variables
3. Send a test POST to your webhook URL:
   ```json
   {"message": "Hi I need an oil change", "channel": "web", "thread_id": "test-001"}
   ```
4. Verify: AI responds as Alex, no APPOINTMENT_DATA block (not enough info yet)
5. Continue conversation until appointment is fully booked
6. Verify Google Calendar event is created and confirmation email is sent
