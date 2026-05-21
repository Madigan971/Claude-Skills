import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'data', 'leads.json');
const PUBLIC_DIR = path.join(ROOT, 'public');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function loadLeads() {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function saveLeads(leads) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(leads, null, 2));
}

function generateId() {
  return crypto.randomBytes(8).toString('hex');
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

function callAnthropic(messages, system) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system,
      messages,
    });

    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) reject(new Error(parsed.error.message));
          else resolve(parsed);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

const QUALIFICATION_SYSTEM = `You are a friendly and professional lead qualification assistant for a home services company specializing in HVAC, plumbing, and electrical services. Your goal is to have a natural conversation to qualify potential customers.

Gather the following information naturally through conversation:
1. Service type needed (HVAC/heating/cooling, plumbing, electrical, or other)
2. Specific issue or job description
3. Urgency level (emergency/urgent, within a week, planning ahead, just exploring)
4. Property type (house, condo, apartment, commercial)
5. Approximate square footage or home size (small <1500sqft, medium 1500-3000sqft, large >3000sqft)
6. How old is the equipment (for repairs) - if applicable
7. Name and preferred contact method (phone or email)
8. ZIP code or city for service area

Guidelines:
- Be warm, empathetic, and professional
- Ask one or two questions at a time max - don't overwhelm
- For emergencies (no heat in winter, flooding, no power), express urgency and prioritize contact info
- Once you have enough info (at minimum: service type, urgency, name, contact), conclude by confirming a specialist will reach out
- Keep responses concise (2-4 sentences typical)

When you have gathered enough information to qualify the lead, end your message with a JSON block like this (on its own line, nothing after it):
LEAD_DATA:{"name":"...","contact":"...","serviceType":"...","urgency":"...","propertyType":"...","issueDescription":"...","zipCode":"...","qualified":true}

Urgency values: "emergency", "urgent", "scheduled", "planning"
ServiceType values: "hvac-repair", "hvac-install", "heating", "cooling", "plumbing", "electrical", "maintenance", "other"`;

const SCORING_SYSTEM = `You are a lead scoring assistant. Given a lead's information, output ONLY a JSON object with these fields:
- score: number 1-100 (higher = better qualified)
- tier: "hot" | "warm" | "cold"
- reasoning: string (1-2 sentences)
- estimatedValue: string (e.g. "$200-500", "$2,000-5,000", "$8,000+")
- followUpPriority: "immediate" | "today" | "this-week"

Scoring criteria:
- Emergency/urgent = higher score
- HVAC installation > repair > maintenance
- Larger homes = higher value
- Specific details provided = better qualified
- Contact info complete = add 10 points

Output ONLY the JSON, no other text.`;

function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

async function handleChat(req, res) {
  const body = await parseBody(req);
  const { messages, sessionId } = body;

  if (!messages || !Array.isArray(messages)) {
    return sendJSON(res, 400, { error: 'messages array required' });
  }

  try {
    const result = await callAnthropic(messages, QUALIFICATION_SYSTEM);
    const assistantText = result.content[0].text;

    let leadData = null;
    const leadMatch = assistantText.match(/LEAD_DATA:(\{[^}]+(?:\}[^}]*)?\})/);
    if (leadMatch) {
      try {
        leadData = JSON.parse(leadMatch[1]);
      } catch {}
    }

    if (leadData && leadData.qualified) {
      // Score the lead
      let score = null;
      try {
        const scoreResult = await callAnthropic(
          [{ role: 'user', content: JSON.stringify(leadData) }],
          SCORING_SYSTEM
        );
        score = JSON.parse(scoreResult.content[0].text);
      } catch {}

      const leads = loadLeads();
      const newLead = {
        id: generateId(),
        sessionId: sessionId || generateId(),
        createdAt: new Date().toISOString(),
        status: 'new',
        ...leadData,
        score: score?.score || 50,
        tier: score?.tier || 'warm',
        estimatedValue: score?.estimatedValue || 'Unknown',
        followUpPriority: score?.followUpPriority || 'today',
        reasoning: score?.reasoning || '',
        conversationLength: messages.length,
      };
      leads.unshift(newLead);
      saveLeads(leads);
    }

    const cleanText = assistantText.replace(/\nLEAD_DATA:\{[^\n]*\}/, '');
    sendJSON(res, 200, { message: cleanText, qualified: !!leadData });
  } catch (err) {
    console.error('Chat error:', err.message);
    sendJSON(res, 500, { error: 'Failed to get AI response. Please check your API key.' });
  }
}

async function handleLeads(req, res, method) {
  if (method === 'GET') {
    const leads = loadLeads();
    return sendJSON(res, 200, leads);
  }

  if (method === 'PATCH') {
    const body = await parseBody(req);
    const { id, status } = body;
    const leads = loadLeads();
    const lead = leads.find(l => l.id === id);
    if (!lead) return sendJSON(res, 404, { error: 'Lead not found' });
    lead.status = status;
    saveLeads(leads);
    return sendJSON(res, 200, lead);
  }

  if (method === 'DELETE') {
    const body = await parseBody(req);
    const { id } = body;
    const leads = loadLeads();
    const filtered = leads.filter(l => l.id !== id);
    saveLeads(filtered);
    return sendJSON(res, 200, { success: true });
  }

  sendJSON(res, 405, { error: 'Method not allowed' });
}

function serveStatic(req, res, urlPath) {
  let filePath = path.join(PUBLIC_DIR, urlPath === '/' ? 'index.html' : urlPath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'text/plain';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // Try index.html for SPA-style routing
      fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (err2, data2) => {
        if (err2) {
          res.writeHead(404);
          res.end('Not Found');
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(data2);
        }
      });
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    }
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;
  const method = req.method.toUpperCase();

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  if (pathname === '/api/chat' && method === 'POST') return handleChat(req, res);
  if (pathname === '/api/leads') return handleLeads(req, res, method);

  serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`\n🏠 AI Lead Qualification App running at http://localhost:${PORT}`);
  console.log(`📊 Admin Dashboard: http://localhost:${PORT}/admin.html`);
  console.log(`\nMake sure ANTHROPIC_API_KEY is set in your environment.\n`);
});
