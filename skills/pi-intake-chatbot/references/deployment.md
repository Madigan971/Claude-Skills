# Build Mode — Deploying the Intake Bot as a Product

Load this when the task is to design, script, or embed the intake chatbot somewhere (web widget, SMS, IVR, intake form, another LLM platform) rather than to run a single live conversation. Reuse the conversation flow, guardrails, and screening from the rest of this skill — this file covers the wrapping.

## Table of contents
- System prompt scaffold
- Conversation state to track
- Structured output (machine-readable)
- Channel notes (web / SMS / voice)
- Data handling, privacy & retention
- Handoff & routing
- Testing checklist

## System prompt scaffold
When generating a system prompt for the deployed bot, include, in order:
1. **Role & scope:** intake assistant for [Firm], plaintiff-side personal injury only; not an attorney.
2. **Guardrails:** the bright lines from `compliance.md` (no legal advice, no fee/value/deadline statements, no representation formed), verbatim in spirit.
3. **Disclaimers:** the three required disclaimers and when to say each.
4. **Flow:** the 9-step flow from SKILL.md, "one question per message," with type-specific branches from `case-types.md`.
5. **Screening & routing rules** from `screening.md`, including the URGENT triggers.
6. **Output contract:** emit the structured summary (below) when intake completes or the user disconnects.
7. **Tone:** warm, brief, empathetic; emergency → tell them to call 911.
8. **Firm specifics to fill in:** firm name, practice areas actually handled, follow-up SLA/timeframe, service states, hours, escalation contact, whether it handles workers' comp, referral resource, and any firm-approved fee language (default: none).

Keep the firm-specific values in a small config block so the same skill serves any firm.

## Conversation state to track
Maintain a running object so nothing is re-asked and the summary is complete:
`case_type, incident_date, incident_location_state, narrative, injuries[], treatment_status, at_fault_party, evidence[], insurance, recorded_statement_given, existing_representation, parties_for_conflict[], damages, contact{name,phone,email,method,best_time,consent}, red_flags[], urgent_flag, routing_decision, open_questions[]`.

## Structured output (machine-readable)
For CRM/case-management integration, emit the human summary (see `assets/intake-summary-template.md`) **and** a JSON object with the fields above. Use ISO dates, `null` for unknown (never fabricate), and an explicit `routing_decision` enum: `escalate | urgent_escalate | attorney_review | decline_represented | decline_scope`. Do not put internal red-flag scoring in anything shown to the client.

## Channel notes
- **Web chat widget:** show a visible disclaimer banner in addition to the spoken one; keep messages short; offer a "talk to a person" button that triggers handoff at any time.
- **SMS:** very short turns; one question per text; respect opt-out ("STOP"); never send full collected PII/PHI back in a single message.
- **Voice / IVR:** confirm spellings of names and callback number by read-back; detect distress and offer a live transfer; on any hint of medical emergency, instruct to hang up and call 911.

## Data handling, privacy & retention
- Collect the minimum needed; **never** SSN, financial/payment, or medical-portal credentials (see `compliance.md`).
- Encrypt in transit and at rest; restrict access to firm staff; log consent to be contacted.
- State a retention policy for non-retained leads and honor deletion requests where required.
- Be transparent that intake data is shared with firm attorneys/staff and is **not** privileged until representation begins.
- Follow applicable law (e.g., US state privacy laws; call-recording consent varies by state — disclose recording).

## Handoff & routing
- On `urgent_escalate`, notify the on-call/intake attorney immediately (page/alert), not just a queued email.
- On `escalate`/`attorney_review`, create the lead in the CRM with the summary + JSON and the promised follow-up timeframe.
- On `decline_*`, log the reason, send the courteous close, and surface any referral resource.
- Always give the caller a way to reach a human.

## Testing checklist
Before launch, verify the bot:
- Refuses to state a specific statute of limitations, case value, fee, or "you have a case."
- Gives the no-advice / no-representation disclaimers at start and close.
- Marks URGENT for government defendants, med-mal, minors, wrongful death, and any timeliness concern.
- Declines gracefully for already-represented and out-of-scope, without a legal verdict.
- Handles an emergency by directing to 911 and pausing.
- Produces a complete summary with `Not provided`/`null` for unknowns and never invents facts.
- Keeps to one question per message and stays empathetic under pressure ("just tell me if I have a case").
