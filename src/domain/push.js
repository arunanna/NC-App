import {createLatestPatientReadGate} from './asyncState.js';

export function notificationTarget(data, session) {
  if (!data || data.kind !== 'patient-status' || session?.mode !== 'live' || session.access !== 'approved'
    || data.uid !== session.user?.uid || typeof data.patientId !== 'string' || !data.patientId || ['.', '..'].includes(data.patientId) || data.patientId.includes('/')
    || data.patientId.length > 255 || typeof data.eventId !== 'string' || !data.eventId || data.eventId.length > 512) return null;
  return {uid: data.uid, patientId: data.patientId, eventId: data.eventId};
}

// Timeout/abort rejects the queue promptly. Every resumed native operation also
// checks the signal before it can send a late registration.
export function createPushManager({getSession, api, native, onStatus = () => {}, operationTimeoutMs = 15000, logoutTimeoutMs = 5000}) {
  let queue = Promise.resolve(); let generation = 0; let active = null;
  const serial = task => { const next = queue.catch(() => {}).then(task); queue = next; return next; };
  const valid = session => {
    const current = getSession();
    return current?.key === session?.key && current?.mode === 'live' && current.access === 'approved'
      && session?.mode === 'live' && session.access === 'approved';
  };
  const bounded = (task, controller, timeoutMs) => {
    let timer; let abort;
    const stopped = new Promise((resolve, reject) => {
      abort = () => reject(new Error('Notification cleanup or registration timed out. Check your connection and retry.'));
      controller.signal.addEventListener('abort', abort, {once: true});
      timer = setTimeout(() => controller.abort(), timeoutMs);
    });
    return Promise.race([Promise.resolve().then(task), stopped]).finally(() => {
      clearTimeout(timer); controller.signal.removeEventListener('abort', abort);
    });
  };
  const enable = (requestPermission = true) => {
    const session = getSession(); const current = ++generation;
    active?.abort(); const controller = new AbortController(); active = controller;
    return serial(() => bounded(async () => {
      const ensure = () => {if (controller.signal.aborted || current !== generation || !valid(session)) throw new Error('The notification session changed.');};
      if (!valid(session) || current !== generation) return;
      onStatus({state: 'checking', message: 'Checking notification permission…'});
      try {
        const disabled = !requestPermission && await native.isDisabled(); ensure();
        if (disabled) {onStatus({state: 'disabled', message: 'Status alerts are off on this device.'}); return;}
        const registration = await native.register(requestPermission); ensure();
        if (!registration) {onStatus({state: 'denied', message: 'Allow notifications in device settings to receive patient status alerts.'}); return;}
        const revision = await native.nextRevision(); ensure();
        await api('/api/mobile/push-tokens', {method: 'POST', body: JSON.stringify({...registration, revision}), signal: controller.signal}); ensure();
        await native.setDisabled(false); ensure();
        onStatus({state: 'enabled', message: 'Patient status alerts are enabled on this device.'});
      } catch (error) {
        if (valid(session) && current === generation) onStatus({state: 'error', message: error.message || 'Notifications could not be enabled. Please retry.'});
        if (requestPermission && valid(session) && current === generation) throw error;
      }
    }, controller, operationTimeoutMs)).catch(error => {
      if (valid(session) && current === generation) onStatus({state: 'error', message: error.message});
      if (requestPermission && valid(session) && current === generation) throw error;
    });
  };
  const disable = ({logout = false} = {}) => {
    const session = getSession(); const current = ++generation;
    active?.abort(); const controller = new AbortController(); active = controller;
    return serial(() => bounded(async () => {
      const ensure = () => {if (controller.signal.aborted || current !== generation || !valid(session)) throw new Error('The notification session changed.');};
      await native.setDisabled(true); ensure();
      const installationId = await native.installationId(); ensure();
      if (installationId) {
        const revision = await native.nextRevision(); ensure();
        await api('/api/mobile/push-tokens', {method: 'DELETE', body: JSON.stringify({installationId, revision}), signal: controller.signal}); ensure();
      }
      if (!logout) onStatus({state: 'disabled', message: 'Status alerts are off on this device.'});
    }, controller, logoutTimeoutMs));
  };
  return {enable, refresh: () => enable(false), disable};
}

// Both receipt and tap publish a fresh, authorized snapshot. The mounted detail
// consumes it without refetching; navigation to an already-open route is safe.
const notificationReadGates = new WeakMap();
export async function refreshNotificationPatient(data, {getSession, getPatient, publish}) {
  const session = getSession(); const target = notificationTarget(data, session);
  if (!target) return null;
  if (!notificationReadGates.has(getPatient)) notificationReadGates.set(getPatient, createLatestPatientReadGate());
  const isLatest = notificationReadGates.get(getPatient).begin(session.key, target.patientId);
  const patient = await getPatient(target.patientId);
  const current = getSession();
  if (!isLatest() || current?.key !== session.key || !notificationTarget(data, current)) return null;
  const update = {...target, sessionKey: session.key, patient};
  publish(update); return update;
}
export function patientFromNotification(update, {patientId, session}) {
  return update?.uid === session?.user?.uid && update.sessionKey === session?.key
    && session?.mode === 'live' && session.access === 'approved' && update.patientId === patientId
    ? {applies: true, patient: update.patient} : {applies: false};
}
