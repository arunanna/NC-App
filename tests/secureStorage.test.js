import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createSecureStorage } from '../src/services/secureStorage.js';

function fixture() {
  const values = new Map(); let failWrites = false;
  const storage = createSecureStorage({ getItemAsync: async key => values.get(key) ?? null,
    setItemAsync: async (key, value) => { if (failWrites && key.endsWith('-1')) throw new Error('Native write failed'); assert.ok(Buffer.byteLength(value) <= 1500); values.set(key, value); },
    deleteItemAsync: async key => { values.delete(key); } });
  return { storage, values, fail: () => { failWrites = true; } };
}
test('large Unicode auth sessions round-trip in bounded secure chunks and are removed', async () => {
  const { storage, values } = fixture(); const value = JSON.stringify({ token: 'a'.repeat(5000), name: '🧠'.repeat(600) });
  await storage.setItem('firebase:auth/session', value); assert.equal(await storage.getItem('firebase:auth/session'), value);
  assert.ok(values.size > 3); assert.ok([...values.keys()].every(key => /^[A-Za-z0-9._-]+$/.test(key)));
  await storage.removeItem('firebase:auth/session'); assert.equal(values.size, 0); assert.equal(await storage.getItem('firebase:auth/session'), null);
});
test('failed new generation preserves the previous saved session', async () => {
  const { storage, fail } = fixture(); await storage.setItem('session', 'previous'); fail();
  await assert.rejects(storage.setItem('session', 'x'.repeat(4000)));
  assert.equal(await storage.getItem('session'), 'previous');
});
test('replacements clean old chunks and serialized writes have deterministic last-write behavior', async () => {
  const { storage, values } = fixture(); await storage.setItem('session', 'x'.repeat(4500));
  await Promise.all([storage.setItem('session', 'first'), storage.setItem('session', 'last')]);
  assert.equal(await storage.getItem('session'), 'last'); assert.equal(values.size, 2);
});
test('corrupt manifests recover to a signed-out state and permit a new session', async () => {
  const { storage, values } = fixture(); await storage.setItem('session', 'original');
  const manifestKey = [...values.keys()].find(key => values.get(key).startsWith('{'));
  values.set(manifestKey, '{invalid'); assert.equal(await storage.getItem('session'), null);
  await storage.setItem('session', 'recovered'); assert.equal(await storage.getItem('session'), 'recovered');
});
