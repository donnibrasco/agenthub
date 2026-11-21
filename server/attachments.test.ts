import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { NeuroDatabase } from './db.ts';
import { detectMedia, linkAttachments, listJobAttachments, prepareAttachments, registerAttachmentRoutes, safeFileName } from './attachments.ts';
import { buildChatCompletionRequest } from './modelProxy.ts';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'attachments-test-'));
process.env.NEURONEST_DB_PATH = path.join(dir, 'db.sqlite');
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

test('detects media by bytes, not by name', () => {
  assert.deepEqual(detectMedia(PNG), { kind: 'image', mime: 'image/png' });
  assert.deepEqual(detectMedia(Buffer.from('ffd8ffe000104a46', 'hex')), { kind: 'image', mime: 'image/jpeg' });
  assert.deepEqual(detectMedia(Buffer.from('000000186674797069736f6d', 'hex')), { kind: 'video', mime: 'video/mp4' });
  assert.equal(detectMedia(Buffer.from('<svg onload=alert(1)>')), null);
});

test('cleans file names', () => {
  assert.equal(safeFileName('../../etc/passwd'), 'passwd');
  assert.equal(safeFileName('..\\secret.txt'), 'secret.txt');
  assert.equal(safeFileName('a<b>:c?.png'), 'a_b_c_.png');
  assert.equal(safeFileName('...'), 'file');
});

test('upload, classify, serve safely, and link to a job', async () => {
  const db = new NeuroDatabase(':memory:');
  const app = express();
  registerAttachmentRoutes(app, db);
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const upload = (name: string, body: Buffer | string) => fetch(`${base}/api/uploads`, {
    method: 'POST', headers: { 'content-type': 'application/octet-stream', 'x-file-name': encodeURIComponent(name) }, body: typeof body === 'string' ? body : new Uint8Array(body),
  }).then(async r => ({ status: r.status, data: await r.json() }));
  try {
    const image = await upload('photo.jpg', PNG); // named .jpg, really a PNG
    assert.equal(image.status, 201);
    assert.equal(image.data.attachment.kind, 'image');
    assert.equal(image.data.attachment.mime, 'image/png');

    const fake = await upload('evil.png', '<script>alert(1)</script>'); // named .png, really text
    assert.notEqual(fake.data.attachment.kind, 'image');
    const served = await fetch(`${base}/api/uploads/${fake.data.attachment.id}`);
    assert.equal(served.headers.get('content-type'), 'application/octet-stream');
    assert.match(served.headers.get('content-disposition') ?? '', /^attachment/);
    assert.equal(served.headers.get('x-content-type-options'), 'nosniff');

    const notes = await upload('notes.md', '# Plan\n- ship it\n');
    assert.equal(notes.data.attachment.kind, 'text');

    const tooBig = await fetch(`${base}/api/uploads`, { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: new Uint8Array(26 * 1024 * 1024) });
    assert.equal(tooBig.status, 413);

    const img = await fetch(`${base}/api/uploads/${image.data.attachment.id}`);
    assert.equal(img.headers.get('content-type'), 'image/png');
    assert.deepEqual(Buffer.from(await img.arrayBuffer()), PNG);

    assert.equal(linkAttachments(db, 'job_1', [image.data.attachment.id, notes.data.attachment.id, 'att_missing']), 2);
    assert.equal(linkAttachments(db, 'job_2', [image.data.attachment.id]), 0, 'an attachment belongs to one job');
    const linked = listJobAttachments(db, 'job_1');
    assert.deepEqual(linked.map(a => a.name).sort(), ['notes.md', 'photo.jpg']);
    assert.equal(db.listJobs().length >= 0, true);

    const forApi = prepareAttachments(linked, { inlineImages: true });
    assert.equal(forApi.images.length, 1);
    assert.equal(forApi.images[0].data, PNG.toString('base64'));
    assert.match(forApi.promptAppendix, /File "notes\.md":\n````\n# Plan\n- ship it/);
    assert.equal(prepareAttachments(linked, { inlineImages: false }).images[0].data, undefined);
  } finally {
    server.close();
  }
});

test('images reach each provider in its own format', () => {
  const images = [{ mime: 'image/png', data: 'QUJD' }];
  const openai = buildChatCompletionRequest('https://api.openai.com/v1', 'OpenAI-Compatible', 'gpt', 'hi', 'k', images);
  assert.deepEqual((openai.body.messages as any)[0].content[1], { type: 'image_url', image_url: { url: 'data:image/png;base64,QUJD' } });
  const claude = buildChatCompletionRequest('https://api.anthropic.com/v1', 'Anthropic', 'claude', 'hi', 'k', images);
  assert.deepEqual((claude.body.messages as any)[0].content[0], { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'QUJD' } });
  const gemini = buildChatCompletionRequest('https://generativelanguage.googleapis.com/v1beta', 'Gemini', 'gemini', 'hi', 'k', images);
  assert.deepEqual((gemini.body.contents as any)[0].parts[1], { inline_data: { mime_type: 'image/png', data: 'QUJD' } });
  const ollama = buildChatCompletionRequest('http://localhost:11434', 'Ollama', 'llava', 'hi', undefined, images);
  assert.deepEqual((ollama.body.messages as any)[0].images, ['QUJD']);
  // Without images the request stays plain text.
  assert.equal((buildChatCompletionRequest('https://api.openai.com/v1', 'OpenAI-Compatible', 'gpt', 'hi').body.messages as any)[0].content, 'hi');
});
