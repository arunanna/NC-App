import test from 'node:test';
import assert from 'node:assert/strict';
import { canOpenFile, documents, finalReport, matchesPatient, ownsFile, profileAccess, profilePatch, releasedReports, statusLabel, text } from '../src/domain/patients.js';

const approved = { source: 'report-builder', reportId: 'final', s3Key: 'clients/doctor/reports/final.pdf' };
const draft = { source: 'report-builder', reportId: 'draft', s3Key: 'clients/doctor/reports/draft.pdf' };
const mdt = { source: 'mdt', s3Key: 'clients/doctor/reports/mdt.pdf' };
const patient = { status: 'completed', finalReportId: 'final', finalReportKey: approved.s3Key, pdfs: [approved, draft, mdt] };

test('completed cases expose only the canonical generated report plus independent MDT reports', () => {
  assert.deepEqual(releasedReports(patient), [approved, mdt]);
  assert.equal(finalReport(patient), approved);
});
test('pending and On Hold cases withhold generated reports', () => {
  for (const status of ['saved', 'pending', 'in-progress', 'report-generation-pending', 'on-hold']) assert.deepEqual(releasedReports({ ...patient, status }), [mdt]);
});
test('canonical report ID/key mismatches fail closed without falling back to a draft', () => {
  assert.equal(finalReport({ ...patient, finalReportId: 'different' }), null);
  assert.deepEqual(releasedReports({ ...patient, finalReportKey: 'missing' }), [mdt]);
});
test('legacy fallback uses the last generated report, never an arbitrary attachment', () => {
  const attachment = { source: 'manual', s3Key: 'clients/doctor/reports/attachment.pdf' };
  assert.equal(finalReport({ status: 'completed', pdfs: [approved, draft, attachment] }), draft);
  assert.equal(finalReport({ status: 'completed', pdfs: [attachment] }), null);
  assert.deepEqual(releasedReports({ status: 'completed', pdfs: [] }), []);
});
test('deleted records expose neither files nor registry entries', () => {
  assert.deepEqual(releasedReports({ ...patient, deletionState: 'pending' }), []);
  assert.deepEqual(documents({ deletionState: 'pending', additionalFiles: [{ s3Key: 'key' }] }), []);
  assert.equal(matchesPatient({ ...patient, deletionState: 'pending' }), false);
});
test('download requires an exact owner path and an allowed released file', () => {
  assert.equal(ownsFile('clients/doctor-two/reports/a.pdf', 'doctor'), false);
  assert.equal(ownsFile('clients/doctor/../other/a.pdf', 'doctor'), false);
  assert.equal(ownsFile('clients/doctor/reports/a.pdf', 'doctor'), true);
  assert.equal(canOpenFile(patient, approved.s3Key, 'doctor'), true);
  assert.equal(canOpenFile(patient, draft.s3Key, 'doctor'), false);
  assert.equal(canOpenFile(patient, approved.s3Key, 'other'), false);
});
test('search matches promised name/MRN fields and combines both in-progress states', () => {
  assert.equal(matchesPatient({ name: 'Demo Patient 1', mrn: 'ABC', status: 'report-generation-pending' }, 'abc', 'in-progress'), true);
  assert.equal(matchesPatient({ name: 'Demo', episodeId: 'hidden', status: 'pending' }, 'hidden'), false);
});
test('approval requires exact identity binding and the doctor role', () => {
  const user = { email: 'doctor@example.invalid' };
  const profile = { email: user.email, role: 'client', emailVerified: true };
  assert.equal(profileAccess(profile, user), 'approved');
  assert.equal(profileAccess({ ...profile, email: 'Doctor@example.invalid' }, user), 'identity');
  assert.equal(profileAccess({ ...profile, role: 'admin' }, user), 'role');
  assert.equal(profileAccess({ ...profile, approvalStatus: 'declined' }, user), 'declined');
  assert.equal(profileAccess({ ...profile, emailVerified: false }, user), 'pending');
  assert.equal(profileAccess(null, user), 'missing');
});
test('profile patches cannot write email, role, approval or arbitrary fields', () => {
  const patch = profilePatch({ name: '  Demo Doctor ', role: 'admin', email: 'change', emailVerified: true, storagePlan: 'max' });
  assert.equal(patch.name, 'Demo Doctor');
  for (const key of ['role', 'email', 'emailVerified', 'storagePlan']) assert.equal(Object.hasOwn(patch, key), false);
});
test('malformed legacy clinical values render safe text including age zero', () => {
  assert.equal(text({ unknown: 'object' }), '—');
  assert.equal(text(0), '0');
  assert.equal(text(['Focal', { invalid: true }, 'Temporal']), 'Focal, Temporal');
  assert.equal(statusLabel('report-generation-pending'), 'In Progress');
});
