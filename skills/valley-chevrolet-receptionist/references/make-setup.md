# How to Set Up the AI Receptionist in Make.com

This is a beginner-friendly guide. Follow the steps in order.

---

## What You'll Need Before You Start

1. A **Make.com account** (free tier works) — sign up at make.com
2. An **Anthropic API key** — get one at console.anthropic.com (costs a few cents per conversation)
3. A **Gmail account** to send email notifications to your team

---

## Step 1 — Import the Scenario

1. Log in to Make.com
2. Click **Scenarios** in the left sidebar
3. Click **Create a new scenario**
4. Click the **three-dot menu (⋯)** in the top right → choose **Import Blueprint**
5. Upload the file: `assets/blueprints/vc-receptionist-all-in-one.json`
6. Your scenario will open with 5 connected modules

---

## Step 2 — Set Up the Webhook (Module 1)

1. Click the first module (the green **Webhooks** block)
2. Click **Add** to create a new webhook
3. Name it something like "VC Customer Chat"
4. Click **Save** — Make will generate a unique URL like:
   `https://hook.make.com/abc123xyz`
5. **Copy this URL** — you'll need it later for your website

---

## Step 3 — Add Your Anthropic API Key (Module 2)

1. Click the second module (the blue **HTTP** block)
2. Find the text that says `{{ANTHROPIC_API_KEY}}`
3. Replace it with your actual API key from console.anthropic.com
   - It looks like: `sk-ant-api03-...`

---

## Step 4 — Connect Gmail (Module 5)

1. Click the last module (the red **Gmail** block)
2. Click **Add** next to the connection field
3. Sign in with your Gmail account and allow access
4. Replace `{{ADVISOR_EMAIL}}` with the email where you want notifications
   (e.g. `service@valleychevrolet.com`)
5. Replace `{{FROM_EMAIL}}` with the same email address

---

## Step 5 — Turn It On and Test

1. Click the **ON/OFF toggle** at the bottom left of the screen to activate the scenario
2. Open a tool like [Reqbin](https://reqbin.com) or Postman
3. Send a test POST request to your webhook URL with this body:
   ```json
   { "message": "Hi, what are your hours?" }
   ```
4. You should see Alex's reply in the response
5. Check your email — you should receive a notification with the conversation

---

## Step 6 — Connect to Your Website

Add a simple chat form to your website that sends a POST request to your webhook URL whenever a customer submits a message. Your web developer can do this in 15 minutes — just give them the webhook URL from Step 2.

---

## That's It!

Every time a customer sends a message, Alex will respond automatically and your team will receive an email summary. No coding required on your end.

**Need help?** Bring this guide to your web developer or IT person — everything they need is here.
