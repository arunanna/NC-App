// Platform dependencies are injected so session changes during a native
// download can be checked without opening a device share sheet in tests.
export function createDocumentOpener({ openBrowser, isSharingAvailable, downloadFile, shareFile, removeFile, cacheDirectory, makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}` }) {
  return async function openDocument(url, file, download = false, assertCurrent = () => {}) {
    assertCurrent();
    if (!download) { await openBrowser(url); return; }
    const available = await isSharingAvailable();
    assertCurrent();
    if (!available || !cacheDirectory) throw new Error('Saving documents is unavailable on this device. Try opening the document instead.');
    const extension = /\.([a-z0-9]{1,8})$/i.exec(file.fileName || file.name || '')?.[1] || 'pdf';
    const path = `${cacheDirectory}nc-document-${makeId()}.${extension}`;
    try {
      const result = await downloadFile(url, path);
      assertCurrent();
      if (result.status < 200 || result.status >= 300) throw new Error('The document could not be downloaded. Please try again.');
      await shareFile(result.uri, { dialogTitle: 'Save document' });
    } finally { await removeFile(path, { idempotent: true }).catch(() => {}); }
  };
}
