export async function openDocument(url, file, download = false, assertCurrent = () => {}) {
  assertCurrent();
  const anchor = document.createElement('a');
  anchor.href = url; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer';
  if (download) anchor.download = file.fileName || file.name || 'document.pdf';
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
}
