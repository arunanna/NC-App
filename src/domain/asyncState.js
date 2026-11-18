// Latest-started read wins per patient and signed-in workspace. The gate stores
// only request counters, never patient records.
export function createLatestPatientReadGate() {
  let currentSession = null;
  const reads = new Map();
  return {
    begin(sessionKey, patientId) {
      if (sessionKey !== currentSession) {currentSession = sessionKey; reads.clear();}
      const sequence = (reads.get(patientId) || 0) + 1;
      reads.set(patientId, sequence);
      return () => currentSession === sessionKey && reads.get(patientId) === sequence;
    },
  };
}
export class StalePatientReadError extends Error {
  constructor() {super('A newer patient read is available. Please retry.'); this.code = 'STALE_PATIENT_READ';}
}

// Independent of ordinary account verification: foreground revalidation may
// finish while cleanup is pending, but it cannot release the logout lock.
export async function withLogoutLock({setLocked, cleanup, finish}) {
  setLocked(true);
  try {await cleanup();}
  finally {try {await finish();} finally {setLocked(false);}}
}
