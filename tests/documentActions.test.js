import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocumentOpener } from '../src/services/documentActions.js';

function setup(overrides = {}) {
  const calls = { shared: [], removed: [], opened: [] };
  const open = createDocumentOpener({
    cacheDirectory: 'cache/', makeId: () => 'test',
    openBrowser: async url => calls.opened.push(url),
    isSharingAvailable: async () => true,
    downloadFile: async (_, path) => ({ status: 200, uri: path }),
    shareFile: async uri => calls.shared.push(uri),
    removeFile: async path => calls.removed.push(path),
    ...overrides,
  });
  return { open, calls };
}

test('sign-out during a download suppresses the share sheet and removes its temporary file', async () => {
  let current = true;
  const { open, calls } = setup({ downloadFile: async (_, path) => { current = false; return { status: 200, uri: path }; } });
  await assert.rejects(open('https://files.example/report', { fileName: 'report.pdf' }, true, () => { if (!current) throw new Error('Session changed'); }), /Session changed/);
  assert.deepEqual(calls.shared, []);
  assert.deepEqual(calls.removed, ['cache/nc-document-test.pdf']);
});

test('a session change while checking device availability prevents the download', async () => {
  let current = true; let downloaded = false;
  const { open } = setup({ isSharingAvailable: async () => { current = false; return true; }, downloadFile: async () => { downloaded = true; } });
  await assert.rejects(open('https://files.example/report', {}, true, () => { if (!current) throw new Error('Session changed'); }), /Session changed/);
  assert.equal(downloaded, false);
});

test('share failure still removes the downloaded document', async () => {
  const { open, calls } = setup({ shareFile: async () => { throw new Error('Share unavailable'); } });
  await assert.rejects(open('https://files.example/report', { fileName: 'report.pdf' }, true), /Share unavailable/);
  assert.deepEqual(calls.removed, ['cache/nc-document-test.pdf']);
});

test('a current session can save a document with cleanup or open it in the system browser', async () => {
  const { open, calls } = setup();
  await open('https://files.example/report', { fileName: 'report.pdf' }, true);
  await open('https://files.example/report', {}, false);
  assert.deepEqual(calls.shared, ['cache/nc-document-test.pdf']);
  assert.deepEqual(calls.removed, ['cache/nc-document-test.pdf']);
  assert.deepEqual(calls.opened, ['https://files.example/report']);
});
