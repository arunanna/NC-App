import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import Constants from 'expo-constants';
import { onIdTokenChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDocFromServer, updateDoc } from 'firebase/firestore';
import { resolveConfig } from '../domain/config';
import { canOpenFile, isPatientAvailable, matchesPatient, profileAccess, profilePatch } from '../domain/patients';
import { DEMO_PATIENTS, DEMO_PROFILE, DEMO_USER } from '../data/demo';
import { ApiError, createApiClient, registryPath, validDownloadUrl } from '../services/api';
import { getFirebase } from '../services/firebase';
import { openDocument } from '../services/documents';
import { uploadAttachments } from '../domain/attachments';
import { putAttachment, cleanupAttachment } from '../services/attachments';
import { createPushManager, notificationTarget as targetFromNotification, refreshNotificationPatient } from '../domain/push';
import * as nativeNotifications from '../services/notifications';
import {createLatestPatientReadGate, StalePatientReadError, withLogoutLock} from '../domain/asyncState';

const AppContext = createContext(null);
const authMessage = error => {
  if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email'].includes(error?.code)) return 'The email address or password is incorrect.';
  if (error?.code === 'auth/too-many-requests') return 'Too many attempts. Please wait before trying again.';
  if (error?.code === 'auth/user-disabled') return 'This account is unavailable. Please contact NeuroClarity.';
  return 'Unable to sign in. Check your connection and try again.';
};

export function AppProvider({ children }) {
  const config = useMemo(() => resolveConfig(Constants.expoConfig?.extra?.mobile), []);
  const services = useMemo(() => {
    if (!config.connected) return null;
    try { return getFirebase(config); } catch { return null; }
  }, [config]);
  const [session, setSession] = useState(null);
  const [verifying, setVerifying] = useState(!!services);
  const [signingOut, setSigningOut] = useState(false);
  const patientReadGate = useRef(createLatestPatientReadGate());
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [pushStatus, setPushStatus] = useState({state: 'disabled', message: 'Enable alerts for patient status changes.'});
  const [notificationTarget, setNotificationTarget] = useState(null);
  const [patientUpdate, setPatientUpdate] = useState(null);
  const pendingNotification = useRef(null);
  const handledNotifications = useRef(new Set());
  const [loadedPatients, setLoadedPatients] = useState([]);
  const revision = useRef(0);
  const sessionRef = useRef(session);
  const commitSession = useCallback(value => { sessionRef.current = value; setSession(value); }, []);

  const clearSession = useCallback((message = '') => {
    revision.current += 1;
    commitSession(null); setLoadedPatients([]); setNotificationTarget(null); setPatientUpdate(null); setPushStatus({state: 'disabled', message: 'Enable alerts for patient status changes.'}); setError(message); setVerifying(false);
  }, [commitSession]);

  const invalidate = useCallback(() => {
    clearSession('Your access could not be verified. Please sign in again.');
    if (services) signOut(services.auth).catch(() => {});
  }, [clearSession, services]);

  const api = useCallback(async (path, options) => {
    if (!services) throw new ApiError('Please sign in again.', 401);
    return createApiClient({ baseUrl: config.apiBaseUrl,
      getUser: () => services.auth.currentUser, getSessionKey: () => revision.current, onUnauthorized: invalidate })(path, options);
  }, [config.apiBaseUrl, invalidate, services]);

  const pushManager = useMemo(() => createPushManager({getSession: () => sessionRef.current, api,
    native: {...nativeNotifications, register: requestPermission => nativeNotifications.register(config, requestPermission)},
    onStatus: setPushStatus,
  }), [api, config]);

  const loadSession = useCallback(async user => {
    const version = ++revision.current;
    const previous = sessionRef.current;
    const sameUser = previous?.mode === 'live' && previous.user.uid === user?.uid;
    if (!sameUser) setLoadedPatients([]);
    setVerifying(!sameUser); setError('');
    if (!user) { clearSession(); return; }
    try {
      const snapshot = await getDocFromServer(doc(services.db, 'users', user.uid));
      if (version !== revision.current || services.auth.currentUser?.uid !== user.uid) return;
      const profile = snapshot.exists() ? snapshot.data() : null;
      const access = profileAccess(profile, user);
      if (access !== 'approved') setLoadedPatients([]);
      commitSession({ mode: 'live', user, profile, access, key: sameUser ? previous.key : `${user.uid}-${version}` });
      setVerifying(false);
    } catch {
      if (version !== revision.current) return;
      clearSession('Unable to verify your account. Check your connection and sign in again.');
      signOut(services.auth).catch(() => {});
    }
  }, [clearSession, commitSession, services]);

  useEffect(() => {
    if (!services) return undefined;
    return onIdTokenChanged(services.auth, user => { loadSession(user); });
  }, [loadSession, services]);

  const refreshAccount = useCallback(async () => {
    if (sessionRef.current?.mode === 'demo' || !services?.auth.currentUser) return;
    const version = revision.current;
    const user = services.auth.currentUser;
    // Revalidate silently so native pickers can return to the same workspace.
    try {
      await user.reload();
      if (version !== revision.current || services.auth.currentUser !== user) return;
      await user.getIdToken(true);
      if (services.auth.currentUser !== user) return;
      await loadSession(services.auth.currentUser);
    } catch { if (version === revision.current && services.auth.currentUser === user) invalidate(); }
  }, [invalidate, loadSession, services]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active' && sessionRef.current?.mode === 'live') refreshAccount().then(() => pushManager.refresh()).catch(() => {});
    });
    return () => subscription.remove();
  }, [refreshAccount, pushManager]);

  const ensureCurrent = useCallback(version => {
    if (version !== revision.current || !sessionRef.current) throw new ApiError('Your session has changed.', 401);
  }, []);

  const signIn = async (email, password) => {
    if (!services) throw new Error(config.error || 'Configure the development connection before signing in.');
    setError('');
    try { await signInWithEmailAndPassword(services.auth, email.trim(), password); }
    catch (failure) { throw new Error(authMessage(failure)); }
  };

  const exploreDemo = async () => {
    if (services?.auth.currentUser) await signOut(services.auth);
    revision.current += 1;
    const value = { mode: 'demo', user: DEMO_USER, profile: { ...DEMO_PROFILE }, access: 'approved', key: `demo-${revision.current}` };
    commitSession(value); setVerifying(false); setError(''); setLoadedPatients(DEMO_PATIENTS);
  };

  const logout = async () => {
    const captured = sessionRef.current;
    const wasLive = captured?.mode === 'live';
    let message = '';
    await withLogoutLock({
      setLocked: setSigningOut,
      cleanup: async () => {
        // This dedicated lock remains set even when loadSession finishes a
        // concurrent foreground verification and clears ordinary verifying.
        setVerifying(true); setLoadedPatients([]); setPatientUpdate(null); setNotificationTarget(null); setNotice(null);
        try {if (wasLive) await pushManager.disable({logout: true});}
        catch {message = 'Signed out. This device could not unregister notifications while offline; alerts contain no patient details.';}
      },
      finish: async () => {
        if (wasLive && services?.auth.currentUser === captured.user) {
          try {await signOut(services.auth);}
          catch {message = 'Sign-out could not be completed. Please close the app and try again.';}
        }
        if (!sessionRef.current || sessionRef.current.key === captured?.key) clearSession(message);
        else setVerifying(false);
      },
    });
  };

  const listPatients = useCallback(async (filters, signal) => {
    const version = revision.current;
    if (sessionRef.current?.mode === 'demo') return { patients: DEMO_PATIENTS.filter(patient => matchesPatient(patient, filters.search, filters.status)), hasNext: false, nextCursor: null };
    if (!api || sessionRef.current?.access !== 'approved') throw new ApiError('Please sign in again.', 401);
    const result = await api(registryPath(filters), { signal });
    ensureCurrent(version);
    return { ...result, patients: (Array.isArray(result.patients) ? result.patients : []).filter(isPatientAvailable) };
  }, [api, ensureCurrent]);

  const recordPatients = useCallback(patients => {
    setLoadedPatients(previous => [...new Map([...previous, ...patients].map(patient => [patient.id, patient])).values()]);
  }, []);

  const getPatient = useCallback(async id => {
    const version = revision.current;
    const user = sessionRef.current?.user;
    if (typeof id !== 'string' || !id || id.includes('/')) throw new ApiError('This patient is unavailable.', 404);
    if (sessionRef.current?.mode === 'demo') return DEMO_PATIENTS.find(patient => patient.id === id) || null;
    if (!api || sessionRef.current?.access !== 'approved') throw new ApiError('Please sign in again.', 401);
    const isLatestRead = patientReadGate.current.begin(sessionRef.current.key, id);
    await api('/api/storage-usage');
    ensureCurrent(version);
    try {
      const snapshot = await getDocFromServer(doc(services.db, 'clients', sessionRef.current.user.uid, 'patients', id));
      ensureCurrent(version);
      if (!isLatestRead()) throw new StalePatientReadError();
      const value = snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } : null;
      if (!isPatientAvailable(value)) return null;
      recordPatients([value]); return value;
    } catch (failure) {
      if (failure?.code === 'STALE_PATIENT_READ') throw failure;
      if (version === revision.current && sessionRef.current?.user === user
        && (failure?.code === 'permission-denied' || failure?.code === 'unauthenticated')) invalidate();
      throw new ApiError('This patient record could not be loaded. Please try again.');
    }
  }, [api, ensureCurrent, invalidate, recordPatients, services]);

  const openNotification = useCallback(async data => {
    const current = sessionRef.current;
    if (!current) { pendingNotification.current = data; return; }
    const target = targetFromNotification(data, current);
    if (!target || handledNotifications.current.has(target.eventId)) return;
    const key = current.key;
    try {
      const update = await refreshNotificationPatient(data, {getSession: () => sessionRef.current, getPatient, publish: setPatientUpdate});
      if (!update?.patient || sessionRef.current?.key !== key) return;
      handledNotifications.current.add(target.eventId);
      if (handledNotifications.current.size > 100) handledNotifications.current.delete(handledNotifications.current.values().next().value);
      setNotificationTarget(target);
    } catch (failure) { if (failure?.code !== 'STALE_PATIENT_READ' && sessionRef.current?.key === key) setNotice({title: 'Patient unavailable', message: 'This patient could not be opened. Refresh your patient list and try again.'}); }
  }, [getPatient]);

  useEffect(() => nativeNotifications.watchNotifications({
    getUid: () => sessionRef.current?.mode === 'live' && sessionRef.current?.access === 'approved' ? sessionRef.current.user.uid : null,
    onOpen: openNotification,
    onReceived: data => { refreshNotificationPatient(data, {getSession: () => sessionRef.current, getPatient, publish: setPatientUpdate}).catch(() => {}); },
    onToken: () => { pushManager.refresh().catch(() => {}); },
  }), [getPatient, openNotification, pushManager]);

  useEffect(() => {
    if (session?.mode === 'live' && session.access === 'approved') {
      pushManager.refresh().catch(() => {});
      if (pendingNotification.current) { const data = pendingNotification.current; pendingNotification.current = null; openNotification(data); }
    }
  }, [session?.key, session?.access, session?.mode, pushManager, openNotification]);

  const viewFile = useCallback(async (patient, file, download = false) => {
    const current = sessionRef.current; const version = revision.current;
    if (!current || !canOpenFile(patient, file.s3Key, current.user.uid)) throw new Error('This document is unavailable.');
    if (current.mode === 'demo') {
      setNotice({ title: 'Sample document', message: 'This is a synthetic demo case. Connected accounts can open and download their released reports and clinical documents here.' }); return;
    }
    const fresh = await getPatient(patient.id);
    ensureCurrent(version);
    if (!canOpenFile(fresh, file.s3Key, current.user.uid)) throw new Error('This document is no longer available. Refresh the patient record.');
    const result = await api('/api/download-url', { method: 'POST', body: JSON.stringify({ key: file.s3Key,
      ...(download ? { downloadAs: file.fileName || file.name || 'document.pdf' } : {}) }) });
    ensureCurrent(version);
    await openDocument(validDownloadUrl(result.presignedUrl, config.environment), file, download, () => ensureCurrent(version));
  }, [api, config.environment, ensureCurrent, getPatient]);

  const attachFiles = useCallback(async (patientId, entries, onChange) => {
    const current = sessionRef.current; const version = revision.current;
    if (!current || current.mode !== 'live' || current.access !== 'approved') throw new Error('Sign in to attach files.');
    const ensure = () => ensureCurrent(version);
    const patient = await getPatient(patientId); ensure();
    if (!patient) throw new Error('This patient is unavailable.');
    const result = await uploadAttachments({patientId, uid: current.user.uid, entries,
      existingCount: patient.additionalFiles?.length || 0, existingKeys: (patient.additionalFiles || []).map(file => file.s3Key), api, putFile: putAttachment, ensureCurrent: ensure, onChange});
    await Promise.all(entries.filter(entry => entry.attached).map(cleanupAttachment));
    return result;
  }, [api, ensureCurrent, getPatient]);

  const saveProfile = async values => {
    const current = sessionRef.current; const version = revision.current;
    if (!current) throw new Error('Please sign in again.');
    const patch = profilePatch(values);
    if (!patch.name) throw new Error('Enter your full name.');
    if (current.mode === 'live') {
      await api('/api/storage-usage'); ensureCurrent(version);
      await updateDoc(doc(services.db, 'users', current.user.uid), patch); ensureCurrent(version);
    }
    commitSession({ ...sessionRef.current, profile: { ...sessionRef.current.profile, ...patch } });
  };

  const requestReset = async email => {
    if (!config.connected || !config.passwordResetUrl) throw new Error('Password reset is not configured for this build. Use the NeuroClarity website or contact support.');
    let response;
    try { response = await fetch(config.passwordResetUrl, { method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim() }) }); }
    catch { throw new Error('Unable to send the request. Check your connection and try again.'); }
    if (!response.ok) throw new Error('The reset request could not be sent. Please try again.');
  };

  const consumeNotification = useCallback(() => setNotificationTarget(null), []);
  return <AppContext.Provider value={{ config, session, verifying: verifying || signingOut, error, servicesAvailable: !!services, signIn, exploreDemo, logout,
    refreshAccount, listPatients, recordPatients, getPatient, viewFile, attachFiles, loadedPatients, saveProfile, requestReset,
    patientUpdate, pushStatus, enablePush: () => pushManager.enable(), disablePush: () => pushManager.disable(), notificationTarget, consumeNotification,
    notice, showNotice: setNotice, dismissNotice: () => setNotice(null) }}>{children}</AppContext.Provider>;
}

export const useApp = () => useContext(AppContext);
