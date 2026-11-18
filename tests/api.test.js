import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient, registryPath, validDownloadUrl } from '../src/services/api.js';

const response = (status, value = {}) => ({ status, ok: status >= 200 && status < 300, json: async () => value });
test('API sends bearer tokens and refreshes once after 401', async () => {
  const refresh = []; const calls = [];
  const user = { uid: 'a', getIdToken: async force => { refresh.push(force); return force ? 'new' : 'old'; } };
  const api = createApiClient({ baseUrl: 'https://api.example.invalid', getUser: () => user, fetchImpl: async (url, options) => { calls.push({ url, options }); return response(calls.length === 1 ? 401 : 200, { patients: [] }); } });
  assert.deepEqual(await api('/api/patients'), { patients: [] });
  assert.deepEqual(refresh, [false, true]);
  assert.equal(calls[1].options.headers.Authorization, 'Bearer new');
  assert.equal(calls[0].options.redirect, 'error');
});
test('403 blocks access without retrying the request', async () => {
  let calls = 0; let invalidated = 0;
  const user = { uid: 'a', getIdToken: async () => 'token' };
  const api = createApiClient({ baseUrl: '', getUser: () => user, onUnauthorized: () => invalidated++, fetchImpl: async () => { calls++; return response(403); } });
  await assert.rejects(api('/api/patients'), error => error.status === 403);
  assert.equal(calls, 1); assert.equal(invalidated, 1);
});
test('two 401 responses invalidate the session after only one refresh', async () => {
  let calls = 0; let invalidated = 0; const user = { uid: 'a', getIdToken: async () => 'token' };
  const api = createApiClient({ baseUrl: '', getUser: () => user, onUnauthorized: () => invalidated++, fetchImpl: async () => { calls++; return response(401); } });
  await assert.rejects(api('/api/patients')); assert.equal(calls, 2); assert.equal(invalidated, 1);
});
test('stale token failures cannot invalidate a newer account', async () => {
  let rejectToken; let invalidated = 0;
  const original = { uid: 'a', getIdToken: () => new Promise((resolve, reject) => { rejectToken = reject; }) };
  let current = original;
  const api = createApiClient({ baseUrl: '', getUser: () => current, onUnauthorized: () => invalidated++, fetchImpl: async () => response(200) });
  const pending = api('/api/patients'); current = { uid: 'b' };
  rejectToken(Object.assign(new Error('expired'), { code: 'auth/user-token-expired' }));
  await assert.rejects(pending); assert.equal(invalidated, 0);
});
test('same-account session replacement discards a late parsed response', async () => {
  let release; let generation = 1; const user = { uid: 'a', getIdToken: async () => 'token' };
  const api = createApiClient({ baseUrl: '', getUser: () => user, getSessionKey: () => generation,
    fetchImpl: async () => ({ status: 200, ok: true, json: () => new Promise(resolve => { release = resolve; }) }) });
  const pending = api('/api/patients'); await new Promise(resolve => setTimeout(resolve, 0)); generation++;
  release({ patients: ['old patient'] }); await assert.rejects(pending, error => error.status === 401);
});
test('registry query preserves search/cursor and combines processing statuses through canonical server label', () => {
  const url = new URL(registryPath({ search: 'Demo & 1', status: 'in-progress', cursor: 'cursor/+' }), 'https://sample.invalid');
  assert.equal(url.searchParams.get('search'), 'Demo & 1'); assert.equal(url.searchParams.get('cursor'), 'cursor/+');
  assert.equal(url.searchParams.get('status'), 'In Progress');
});
test('download URL validation fails closed', () => { assert.throws(() => validDownloadUrl('javascript:alert(1)', 'development')); assert.equal(validDownloadUrl('https://storage.example.invalid/report.pdf', 'development'), 'https://storage.example.invalid/report.pdf'); });
