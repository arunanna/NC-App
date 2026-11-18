import test from 'node:test';
import assert from 'node:assert/strict';
import {createLatestPatientReadGate, StalePatientReadError, withLogoutLock} from '../src/domain/asyncState.js';

const deferred = () => {let resolve; const promise = new Promise(done => {resolve = done;}); return {promise, resolve};};
test('logout lock survives foreground verification and remains held until Auth cleanup finishes', async () => {
  const cleanup = deferred(); const auth = deferred();
  let verifying = true; let signingOut = false; let signOutStarted = false;
  const pending = withLogoutLock({setLocked: value => {signingOut = value;}, cleanup: () => cleanup.promise,
    finish: async () => {signOutStarted = true; await auth.promise;}});
  assert.equal(signingOut, true);
  // Concurrent loadSession completes the same user's foreground check.
  verifying = false;
  assert.equal(verifying || signingOut, true);
  cleanup.resolve(); await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(signOutStarted, true); assert.equal(verifying || signingOut, true);
  auth.resolve(); await pending; assert.equal(signingOut, false);
});
test('logout always reaches Auth cleanup and releases the lock after a cleanup failure', async () => {
  const events = [];
  await assert.rejects(withLogoutLock({setLocked: value => events.push(value), cleanup: async () => {throw new Error('offline');}, finish: async () => events.push('signOut')}));
  assert.deepEqual(events, [true, 'signOut', false]);
});
test('an older patient response cannot regress shared Updates after a newer read publishes', async () => {
  const gate = createLatestPatientReadGate(); const e1 = deferred(); const e2 = deferred(); let sharedPatient;
  const read = async pending => {
    const isLatest = gate.begin('a-session', 'patient-p');
    const patient = await pending;
    if (!isLatest()) throw new StalePatientReadError();
    sharedPatient = patient; return patient;
  };
  const old = read(e1.promise).catch(error => error); const latest = read(e2.promise);
  e2.resolve({id: 'patient-p', status: 'completed'}); await latest;
  e1.resolve({id: 'patient-p', status: 'in-progress'});
  assert.equal((await old).code, 'STALE_PATIENT_READ'); assert.equal(sharedPatient.status, 'completed');
});
test('latest patient gates are independent per patient and invalidate old sessions', () => {
  const gate = createLatestPatientReadGate(); const p = gate.begin('a-session', 'p'); const q = gate.begin('a-session', 'q');
  assert.equal(p(), true); assert.equal(q(), true);
  const newP = gate.begin('a-session', 'p'); assert.equal(p(), false); assert.equal(q(), true); assert.equal(newP(), true);
  gate.begin('b-session', 'p'); assert.equal(q(), false); assert.equal(newP(), false);
});
