import test from 'node:test';
import assert from 'node:assert/strict';
import { extractAssistantText, isAllowedOrigin, validateMessages } from '../server/aiProxy.js';

test('extractAssistantText membaca respons JSON OpenAI-compatible', () => {
  const body = JSON.stringify({ choices: [{ message: { content: 'Jawaban alami.' } }] });
  assert.equal(extractAssistantText(body, 'application/json'), 'Jawaban alami.');
});

test('extractAssistantText menggabungkan chunk SSE', () => {
  const body = [
    'data: {"choices":[{"delta":{"role":"assistant"}}]}',
    '',
    'data: {"choices":[{"delta":{"content":"Halo "}}]}',
    '',
    'data: {"choices":[{"delta":{"content":"Bos!"}}]}',
    '',
    'data: [DONE]',
    '',
  ].join('\n');

  assert.equal(extractAssistantText(body, 'text/event-stream'), 'Halo Bos!');
});

test('validateMessages menolak role dan payload berlebihan', () => {
  assert.throws(() => validateMessages([{ role: 'tool', content: 'x' }, { role: 'user', content: 'hi' }]), /tidak valid/i);
  assert.throws(() => validateMessages(Array.from({ length: 12 }, () => ({ role: 'user', content: 'x' }))), /terlalu banyak/i);
});

test('validateMessages menerima percakapan normal', () => {
  const messages = [{ role: 'system', content: 'fakta toko' }, { role: 'user', content: 'halo' }];
  assert.deepEqual(validateMessages(messages), messages);
});

test('isAllowedOrigin hanya menerima same-origin dan GitHub Pages resmi', () => {
  assert.equal(isAllowedOrigin('http://localhost:5173', 'localhost:5173'), true);
  assert.equal(
    isAllowedOrigin('https://kopdespungpungan-code.github.io', 'vnrnim.tailef6b6d.ts.net'),
    true,
  );
  assert.equal(isAllowedOrigin('https://evil.example', 'vnrnim.tailef6b6d.ts.net'), false);
});
