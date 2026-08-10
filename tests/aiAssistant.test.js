import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAiMessages } from '../src/lib/aiAssistant.js';

test('buildAiMessages menyertakan data toko sebagai sumber fakta dan riwayat percakapan', () => {
  const soRows = [{ produk: 'Milo', qty: 12, expired: '2099-12-31' }];
  const salesRows = [{ key: '2026-08-10', omset: 150000 }];
  const history = [
    { sender: 'user', text: 'Halo' },
    { sender: 'bot', text: 'Halo Mas Dedik, mau cek apa?' },
  ];

  const messages = buildAiMessages('Kalau stoknya?', soRows, salesRows, history);

  assert.equal(messages.at(-1).role, 'user');
  assert.equal(messages.at(-1).content, 'Kalau stoknya?');
  assert.deepEqual(messages.slice(-3, -1), [
    { role: 'user', content: 'Halo' },
    { role: 'assistant', content: 'Halo Mas Dedik, mau cek apa?' },
  ]);
  assert.match(messages[0].content, /Milo/);
  assert.match(messages[0].content, /12/);
  assert.match(messages[0].content, /Rp150\.000/);
  assert.match(messages[0].content, /jangan mengarang/i);
});

test('buildAiMessages menyertakan seluruh produk agar pencarian stok tidak kehilangan data', () => {
  const soRows = Array.from({ length: 216 }, (_, i) => ({ produk: `Produk-${i + 1}`, grocery: i + 1 }));
  const messages = buildAiMessages('Cari Produk-216', soRows, [], []);

  assert.match(messages[0].content, /Produk-216/);
});

test('buildAiMessages membatasi riwayat agar payload tetap ringan', () => {
  const history = Array.from({ length: 20 }, (_, i) => ({
    sender: i % 2 ? 'bot' : 'user',
    text: `pesan-${i}`,
  }));

  const messages = buildAiMessages('lanjut', [], [], history);
  const historyMessages = messages.slice(1, -1);

  assert.equal(historyMessages.length, 8);
  assert.equal(historyMessages[0].content, 'pesan-12');
});
