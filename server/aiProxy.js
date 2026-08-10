import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DEFAULT_UPSTREAM = 'http://localhost:20128/v1/chat/completions';
const MAX_BODY_BYTES = 256 * 1024;
const DEFAULT_PUBLIC_ORIGINS = ['https://kopdespungpungan-code.github.io'];
const requestBuckets = new Map();

export function extractAssistantText(body, contentType = '') {
  if (contentType.includes('application/json')) {
    const data = JSON.parse(body);
    return data?.choices?.[0]?.message?.content?.trim() || '';
  }

  let text = '';
  for (const line of body.split(/\r?\n/)) {
    if (!line.startsWith('data:')) continue;
    const raw = line.slice(5).trim();
    if (!raw || raw === '[DONE]') continue;
    try {
      const chunk = JSON.parse(raw);
      text += chunk?.choices?.[0]?.delta?.content || '';
    } catch {
      // Abaikan heartbeat/chunk SSE yang bukan JSON lengkap.
    }
  }
  return text.trim();
}

function readLocalProviderKey() {
  if (process.env.AI_PROXY_API_KEY) return process.env.AI_PROXY_API_KEY;

  const candidates = [
    process.env.HERMES_CONFIG,
    path.join(os.homedir(), '.hermes/profiles/coding/config.yaml'),
    path.join(os.homedir(), '.hermes/config.yaml'),
  ].filter(Boolean);

  for (const file of candidates) {
    try {
      const yaml = fs.readFileSync(file, 'utf8');
      const match = yaml.match(/base_url:\s*http:\/\/localhost:20128\/v1\s*\n\s*api_key:\s*([^\n]+)/);
      if (match) return match[1].trim().replace(/^['"]|['"]$/g, '');
    } catch {
      // Coba lokasi berikutnya.
    }
  }
  return '';
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error('Payload terlalu besar');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

export function validateMessages(messages) {
  const invalid = (message, statusCode = 400) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    throw error;
  };
  if (!Array.isArray(messages) || messages.length < 2) invalid('Pesan AI tidak valid');
  if (messages.length > 10) invalid('Terlalu banyak pesan');
  for (const message of messages) {
    if (!['system', 'user', 'assistant'].includes(message?.role) || typeof message.content !== 'string') {
      invalid('Pesan AI tidak valid');
    }
    if (!message.content.trim() || message.content.length > 120000) invalid('Isi pesan tidak valid');
  }
  return messages;
}

export function isAllowedOrigin(origin, host) {
  if (!origin) return true;
  try {
    const configured = (process.env.AI_ALLOWED_ORIGINS || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const allowed = new Set([...DEFAULT_PUBLIC_ORIGINS, ...configured]);
    return new URL(origin).host === host || allowed.has(origin);
  } catch {
    return false;
  }
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (!origin || !isAllowedOrigin(origin, req.headers.host)) return;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-KDKMP-AI');
  res.setHeader('Vary', 'Origin');
}

function withinRateLimit(req) {
  const key = req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const recent = (requestBuckets.get(key) || []).filter((time) => now - time < 60000);
  if (recent.length >= 20) return false;
  recent.push(now);
  requestBuckets.set(key, recent);
  return true;
}

export function createAiProxyMiddleware({ fetchImpl = fetch } = {}) {
  return async (req, res, next) => {
    if (req.url !== '/api/ai') return next();
    const originAllowed = isAllowedOrigin(req.headers.origin, req.headers.host);
    if (req.method === 'OPTIONS') {
      if (!originAllowed) {
        res.statusCode = 403;
        return res.end();
      }
      applyCors(req, res);
      res.statusCode = 204;
      return res.end();
    }
    if (req.method !== 'POST') {
      res.statusCode = 405;
      return res.end(JSON.stringify({ error: 'Method not allowed' }));
    }

    if (!originAllowed || req.headers['x-kdkmp-ai'] !== '1') {
      res.statusCode = 403;
      return res.end(JSON.stringify({ error: 'Akses AI ditolak' }));
    }
    applyCors(req, res);
    if (!withinRateLimit(req)) {
      res.statusCode = 429;
      return res.end(JSON.stringify({ error: 'Terlalu banyak permintaan, coba sebentar lagi' }));
    }

    try {
      const { messages } = await readJsonBody(req);
      validateMessages(messages);

      const apiKey = readLocalProviderKey();
      if (!apiKey) throw new Error('API key model lokal tidak ditemukan');

      const upstream = await fetchImpl(process.env.AI_PROXY_URL || DEFAULT_UPSTREAM, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'bestgrafity',
          messages,
          temperature: 0.82,
          max_tokens: 700,
          stream: false,
        }),
        signal: AbortSignal.timeout(90000),
      });
      const body = await upstream.text();
      if (!upstream.ok) throw new Error(`Model lokal HTTP ${upstream.status}`);

      const answer = extractAssistantText(body, upstream.headers.get('content-type') || '');
      if (!answer) throw new Error('Model lokal mengirim jawaban kosong');

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({ answer, model: 'bestgrafity', grounded: true }));
    } catch (error) {
      console.error('[AI proxy]', error.message);
      res.statusCode = error.statusCode || (error instanceof SyntaxError ? 400 : 502);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({ error: error.message }));
    }
  };
}
