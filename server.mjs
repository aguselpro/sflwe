import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT || 3000);
const apiKey = process.env.ELEVENLABS_API_KEY;
let voicesCache = { at: 0, items: [] };
const requestsByIp = new Map();

function allowSpeechRequest(ip) {
  const now = Date.now();
  const recent = (requestsByIp.get(ip) || []).filter(time => now - time < 60 * 60 * 1000);
  if (recent.length >= 30) return false;
  recent.push(now);
  requestsByIp.set(ip, recent);
  return true;
}

function json(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
}

async function readJson(req, maxBytes = 20000) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > maxBytes) throw new Error('La solicitud es demasiado grande.');
  }
  return JSON.parse(body || '{}');
}

async function listMaleSpanishVoices() {
  if (!apiKey) throw new Error('Falta configurar ELEVENLABS_API_KEY en el servidor.');
  if (Date.now() - voicesCache.at < 5 * 60 * 1000 && voicesCache.items.length) return voicesCache.items;
  const url = new URL('https://api.elevenlabs.io/v2/voices');
  url.searchParams.set('gender', 'male');
  url.searchParams.set('language', 'es');
  url.searchParams.set('page_size', '100');
  url.searchParams.set('include_total_count', 'false');
  const response = await fetch(url, { headers: { 'xi-api-key': apiKey } });
  if (!response.ok) throw new Error(`ElevenLabs respondió ${response.status} al buscar voces.`);
  const data = await response.json();
  const items = (data.voices || []).map(v => ({
    id: v.voice_id,
    name: v.name,
    accent: v.labels?.accent || v.verified_languages?.find(x => x.language === 'es')?.accent || 'Acento no indicado',
    description: v.description || ''
  }));
  items.sort((a, b) => (/chile/i.test(b.accent) ? 1 : 0) - (/chile/i.test(a.accent) ? 1 : 0));
  voicesCache = { at: Date.now(), items };
  return items;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (req.method === 'GET' && url.pathname === '/api/voices') {
      return json(res, 200, { voices: await listMaleSpanishVoices() });
    }
    if (req.method === 'POST' && url.pathname === '/api/speech') {
      if (!apiKey) return json(res, 503, { error: 'Configura ELEVENLABS_API_KEY para activar la voz natural.' });
      if (!allowSpeechRequest(req.socket.remoteAddress || 'unknown')) return json(res, 429, { error: 'Se alcanzó el límite local de 30 audios por hora.' });
      const { text, voiceId } = await readJson(req);
      if (typeof text !== 'string' || !text.trim() || text.length > 5000) return json(res, 400, { error: 'El texto debe tener entre 1 y 5000 caracteres.' });
      const allowed = await listMaleSpanishVoices();
      if (!allowed.some(v => v.id === voiceId)) return json(res, 400, { error: 'Selecciona una voz masculina en español de la lista.' });
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
        method: 'POST',
        headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.48, similarity_boost: 0.78, style: 0.15, use_speaker_boost: true }
        })
      });
      if (!response.ok) {
        const detail = await response.text();
        return json(res, response.status, { error: `No se pudo generar el audio (${response.status}). ${detail.slice(0, 300)}` });
      }
      res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' });
      return res.end(Buffer.from(await response.arrayBuffer()));
    }
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      const html = await readFile(join(root, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(html);
    }
    json(res, 404, { error: 'No encontrado.' });
  } catch (error) {
    json(res, 500, { error: error.message || 'Error interno.' });
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Programa disponible en http://localhost:${port}`);
  if (!apiKey) console.log('Configura ELEVENLABS_API_KEY para habilitar la voz natural.');
});
