import { DOCUMENT_MIME, validateAttachment } from '../domain/attachments';
export async function pickAttachments(source) {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input'); input.type = 'file'; input.multiple = source !== 'camera';
    input.accept = source === 'files' ? Object.keys(DOCUMENT_MIME).map(extension => `.${extension}`).join(',') : 'image/jpeg,image/png,image/gif,image/webp';
    if (source === 'camera') input.setAttribute('capture', 'environment');
    input.oncancel = () => resolve([]);
    input.onchange = () => {
      try { resolve(Array.from(input.files || []).map(file => ({...validateAttachment({name: file.name, size: file.size}), file, id: `${file.name}-${file.lastModified}-${Math.random()}`, type: ''}))); }
      catch (error) { reject(error); }
    };
    input.click();
  });
}
export async function cleanupAttachment() {}
export function putAttachment(url, file, onProgress, ensureCurrent) {
  return new Promise((resolve, reject) => {
    ensureCurrent();
    const xhr = new XMLHttpRequest(); xhr.open('PUT', url); xhr.setRequestHeader('Content-Type', file.contentType);
    xhr.upload.onprogress = event => {
      try { ensureCurrent(); if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100)); }
      catch (error) { xhr.abort(); reject(error); }
    };
    xhr.onload = () => { try { ensureCurrent(); if (xhr.status >= 200 && xhr.status < 300) resolve(); else reject(new Error('The file could not be uploaded. Please retry.')); } catch (error) { reject(error); } };
    xhr.onerror = () => reject(new Error('The upload connection failed. Please retry.'));
    xhr.onabort = () => reject(new Error('The upload was cancelled.'));
    file.cancelUpload = () => xhr.abort();
    xhr.addEventListener('loadend', () => { delete file.cancelUpload; });
    xhr.send(file.file);
  });
}
