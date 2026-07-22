# Injury Intake Assistant — Web Demo

A self-contained, client-facing demo of the [`pi-intake-chatbot`](../../skills/pi-intake-chatbot) skill: a chat-widget web page a prospective client could actually use.

`index.html` runs entirely in the browser — no backend or API key. It walks an injured person through the skill's intake flow one question at a time (case type → what happened → date → location → government-entity check → medical care → fault → existing representation → contact → consent), then screens the matter, routes it (normal follow-up, **urgent**, or a courteous close for already-represented callers), and produces a downloadable intake summary.

The skill's guardrails are built in: it never gives legal advice, never states a statute of limitations, never quotes fees or case value; it shows the "not an attorney / no representation yet" disclaimer, and flags government/medical/wrongful-death/time-sensitive matters as urgent.

## Notes

- **"Meridian Injury Law" is a placeholder** sample brand. Swap the wordmark, colors, follow-up timeframe, and service area for a real firm before any live use.
- The "Save my summary" button uses the Artifact `downloads` runtime capability, so it works when the page is opened as a published Artifact.
- Intake is a structured questionnaire, so the demo is deterministic (no LLM call). To make replies free-form and adaptive, drive the same flow with the Claude API using the skill contents as the system prompt.
