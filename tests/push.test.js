import test from 'node:test';
import assert from 'node:assert/strict';
import {releasedReports} from '../src/domain/patients.js';
import {notificationTarget, createPushManager, refreshNotificationPatient, patientFromNotification} from '../src/domain/push.js';
const live = () => ({key: 'a-1', mode: 'live', access: 'approved', user: {uid: 'a'}});
const registration = {token: 'ExpoPushToken[abcdefghijklmnop]', installationId: 'installation-abcdefghijklmnop', platform: 'android'};
const fixture = () => {
  let session = live(); const calls = []; const status = []; let disabled = false;
  let revision = 0;
  const native = {nextRevision: async () => ++revision, register: async () => registration, installationId: async () => registration.installationId, isDisabled: async () => disabled, setDisabled: async value => {disabled = value;}};
  const manager = createPushManager({operationTimeoutMs: 30, logoutTimeoutMs: 15, getSession: () => session, api: async (path, options) => {calls.push(options.method);}, native, onStatus: value => status.push(value)});
  return {manager, calls, status, native, setSession: value => {session = value;}};
};
test('notification taps accept only current approved owner and safe patient identifiers', () => {
  const data = {kind: 'patient-status', uid: 'a', patientId: 'p', eventId: 'event'};
  assert.deepEqual(notificationTarget(data, live()), {uid: 'a', patientId: 'p', eventId: 'event'});
  assert.equal(notificationTarget({...data, uid: 'b'}, live()), null);
  assert.equal(notificationTarget({...data, patientId: '../secret'}, live()), null);
  assert.equal(notificationTarget(data, {...live(), access: 'pending'}), null);
  assert.equal(notificationTarget(data, {...live(), mode: 'demo'}), null);
});
test('permission denial never registers a token or reports enabled', async () => {
  const {manager, native, calls, status} = fixture(); native.register = async () => null;
  await manager.enable(); assert.deepEqual(calls, []); assert.equal(status.at(-1).state, 'denied');
});
test('registration failure reports setup/error rather than enabled', async () => {
  const {manager, native, status} = fixture(); native.register = async () => {throw new Error('Build setup missing');};
  await assert.rejects(manager.enable(), /setup/); assert.equal(status.at(-1).state, 'error');
});
test('logout waits for in-flight registration, then unregisters that installation', async () => {
  const {manager, native, calls} = fixture(); let release;
  native.register = () => new Promise(resolve => {release = resolve;});
  const enabling = manager.enable(); await new Promise(resolve => setTimeout(resolve, 0));
  const disabling = manager.disable({logout: true}); release(registration);
  await enabling; await disabling; assert.deepEqual(calls, ['DELETE']);
});
test('a registration resolving after an account change cannot bind the new account', async () => {
  const {manager, native, setSession, calls, status} = fixture(); let release;
  native.register = () => new Promise(resolve => {release = resolve;});
  const enabling = manager.enable(); await new Promise(resolve => setTimeout(resolve, 0));
  setSession({...live(), key: 'b-2', user: {uid: 'b'}}); release(registration);
  await enabling; assert.deepEqual(calls, []); assert.equal(status.some(value => value.state === 'enabled'), false);
});
test('enabled devices refresh registration on foreground/token rotation and explicit disable persists', async () => {
  const {manager, calls, status} = fixture();
  await manager.enable(); await manager.refresh(); await manager.disable(); await manager.refresh();
  assert.deepEqual(calls, ['POST', 'POST', 'DELETE']); assert.equal(status.at(-1).state, 'disabled');
});

test('a mounted patient receives fresh status/released-report data on receipt and on same-route tap', async () => {
  const session = live();
  let displayed = {id: 'p', status: 'pending', pdfs: []};
  const mounted = {patientId: 'p', session};
  const data = {kind: 'patient-status', uid: 'a', patientId: 'p', eventId: 'receipt-event'};
  const publish = update => {const next = patientFromNotification(update, mounted); if (next.applies) displayed = next.patient;};
  const completed = {id: 'p', status: 'completed', finalReportKey: 'clients/a/final.pdf', pdfs: [{s3Key: 'clients/a/final.pdf', source: 'report-builder'}]};
  await refreshNotificationPatient(data, {getSession: () => session, getPatient: async () => completed, publish});
  assert.equal(displayed.status, 'completed'); assert.equal(releasedReports(displayed).length, 1);
  const held = {...completed, status: 'on-hold'};
  await refreshNotificationPatient({...data, eventId: 'tap-event'}, {getSession: () => session, getPatient: async () => held, publish});
  assert.equal(displayed.status, 'on-hold'); assert.equal(releasedReports(displayed).length, 0);
});
test('notification refresh cannot update a mounted patient after an account change', async () => {
  let session = live(); let release; let published = false;
  const pending = refreshNotificationPatient({kind: 'patient-status', uid: 'a', patientId: 'p', eventId: 'e'}, {
    getSession: () => session, getPatient: () => new Promise(resolve => {release = resolve;}), publish: () => {published = true;},
  });
  session = {...live(), key: 'b-2', user: {uid: 'b'}}; release({id: 'p', status: 'completed'});
  assert.equal(await pending, null); assert.equal(published, false);
});
test('logout cancels a stalled native registration promptly and prevents a later POST', async () => {
  const {manager, native, calls} = fixture(); let release;
  native.register = () => new Promise(resolve => {release = resolve;});
  const enabling = manager.enable().catch(() => {}); await new Promise(resolve => setTimeout(resolve, 0));
  await manager.disable({logout: true}); release(registration); await enabling;
  await new Promise(resolve => setTimeout(resolve, 0)); assert.deepEqual(calls, ['DELETE']);
});
test('stalled DELETE is aborted/deadlined so the logout caller can always sign out', async () => {
  let signedOut = false; let signal;
  const session = live(); const manager = createPushManager({getSession: () => session, logoutTimeoutMs: 5,
    native: {setDisabled: async () => {}, installationId: async () => registration.installationId, nextRevision: async () => 2},
    api: async (path, options) => {signal = options.signal; return new Promise(() => {});},
  });
  try {await manager.disable({logout: true});} catch {} finally {signedOut = true;}
  assert.equal(signedOut, true); assert.equal(signal.aborted, true);
});
test('same-key approval revocation blocks a resumed registration', async () => {
  const {manager, native, setSession, calls} = fixture(); let release;
  native.register = () => new Promise(resolve => {release = resolve;});
  const enabling = manager.enable().catch(() => {}); await new Promise(resolve => setTimeout(resolve, 0));
  setSession({...live(), access: 'pending'}); release(registration); await enabling; assert.deepEqual(calls, []);
});

test('overlapping push reads publish only the newest patient snapshot to a mounted detail', async () => {
  const session = live(); const reads = []; const published = [];
  const getPatient = () => new Promise(resolve => reads.push(resolve));
  const options = {getSession: () => session, getPatient, publish: update => published.push(update)};
  const data = {kind: 'patient-status', uid: 'a', patientId: 'p', eventId: 'e1'};
  const older = refreshNotificationPatient(data, options);
  const newer = refreshNotificationPatient({...data, eventId: 'e2'}, options);
  reads[1]({id: 'p', status: 'completed', finalReportKey: 'clients/a/final.pdf', pdfs: [{s3Key: 'clients/a/final.pdf', source: 'report-builder'}]});
  await newer;
  reads[0]({id: 'p', status: 'in-progress', pdfs: []});
  assert.equal(await older, null); assert.equal(published.length, 1);
  const mounted = patientFromNotification(published[0], {patientId: 'p', session});
  assert.equal(mounted.patient.status, 'completed'); assert.equal(releasedReports(mounted.patient).length, 1);
});
