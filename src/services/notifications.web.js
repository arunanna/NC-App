export async function installationId() { return null; }
export async function isDisabled() { return true; }
export async function setDisabled() {}
export async function register() { throw new Error('Patient status push alerts are available in the installed Android or iOS app.'); }
export function watchNotifications() { return () => {}; }

export async function nextRevision() { return Date.now(); }
