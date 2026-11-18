import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAttachment, uploadAttachments} from '../src/domain/attachments.js';
const file = (name = 'clinical.pdf') => ({...validateAttachment({name, size: 10}), id: name, type: 'clinical-profile'});
const presign = name => ({key: `clients/u/patients/${name}`, presignedPutUrl: 'https://storage.example.invalid/signed-put', presignedGetUrl: 'https://storage.example.invalid/signed-get'});

test('attachments share the website extension, category and size ceilings', () => {
  assert.equal(validateAttachment({name: 'deck.PPTX', size: 500 * 1024 * 1024}).contentType, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
  for (const value of [{name: 'patient.dcm', size: 100}, {name: 'empty.pdf', size: 0}, {name: 'photo.jpg', size: 26 * 1024 * 1024}, {name: 'old.ppt', size: 1}]) assert.throws(() => validateAttachment(value));
});
test('uploads sign exact MIME/bytes then finalize an owner key without trusting stored links', async () => {
  const calls = []; const entry = file(); const puts = [];
  await uploadAttachments({patientId: 'p', uid: 'u', entries: [entry], ensureCurrent() {},
    api: async (path, options) => {calls.push([path, JSON.parse(options.body)]); return path === '/api/upload-url' ? presign(entry.name) : {success: true};},
    putFile: async (url, selected) => puts.push([url, selected.contentType])});
  assert.deepEqual(calls[0], ['/api/upload-url', {fileName: 'clinical.pdf', contentType: 'application/pdf', expectedSize: 10}]);
  assert.equal(calls[1][0], '/api/patients/p/documents'); assert.equal(calls[1][1].documents[0].s3Key, 'clients/u/patients/clinical.pdf');
  assert.deepEqual(puts, [['https://storage.example.invalid/signed-put', 'application/pdf']]); assert.equal(entry.attached, true);
});
test('finalize retry reuses the uploaded key after a lost response, even at the 50 document cap', async () => {
  const entry = file(); let finalized = false; let puts = 0; let presigns = 0;
  const api = async path => {
    if (path === '/api/upload-url') {presigns++; return presign(entry.name);}
    if (!finalized) {finalized = true; throw new Error('response lost');} return {success: true};
  };
  const args = {patientId: 'p', uid: 'u', entries: [entry], ensureCurrent() {}, api, putFile: async () => {puts++;}};
  await assert.rejects(uploadAttachments(args));
  await uploadAttachments({...args, existingCount: 50, existingKeys: [entry.uploaded.s3Key]});
  assert.equal(puts, 1); assert.equal(presigns, 1); assert.equal(entry.attached, true);
});
test('partial success is retained and retries skip already attached files', async () => {
  const entries = [file('first.pdf'), file('second.pdf')]; let failed = false; let puts = 0;
  const api = async (path, options) => {
    const body = JSON.parse(options.body);
    if (path === '/api/upload-url') return presign(body.fileName);
    if (!failed && body.documents[0].name === 'second.pdf') {failed = true; throw new Error('offline');} return {success: true};
  };
  const args = {patientId: 'p', uid: 'u', entries, ensureCurrent() {}, api, putFile: async () => {puts++;}};
  await assert.rejects(uploadAttachments(args)); assert.equal(entries[0].attached, true);
  await uploadAttachments(args); assert.equal(puts, 2); assert.ok(entries.every(entry => entry.attached));
});
test('ownership and stale sessions stop before uploading/finalizing', async () => {
  let put = 0; let finalized = 0;
  await assert.rejects(uploadAttachments({patientId: 'p', uid: 'u', entries: [file()], ensureCurrent() {},
    api: async () => ({...presign('f'), key: 'clients/v/patients/foreign.pdf'}), putFile: async () => {put++;}}));
  let current = true;
  await assert.rejects(uploadAttachments({patientId: 'p', uid: 'u', entries: [file()], ensureCurrent() {if (!current) throw new Error('session changed');},
    api: async path => {if (path !== '/api/upload-url') finalized++; return presign('f');}, putFile: async () => {current = false;}}));
  assert.equal(put, 0); assert.equal(finalized, 0);
});
