import { ownsFile } from './patients.js';
import { isSafeUrl } from './config.js';

// Keep these contracts in sync with the web uploadClient/documentTypes modules.
export const DOCUMENT_TYPES = [['clinical-profile', 'Clinical profile'], ['veeg', 'Video-EEG'], ['referral', 'Referral'], ['clinical-report', 'Clinical report'], ['other', 'Other']];
export const DOCUMENT_MIME = {pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', txt: 'text/plain', csv: 'text/csv', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', xls: 'application/vnd.ms-excel', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp'};
export function validateAttachment(file) {
  const name = typeof file?.name === 'string' ? file.name.trim() : '';
  const extension = name.split('.').pop().toLowerCase();
  if (!name || name.length > 255 || !Object.hasOwn(DOCUMENT_MIME, extension)) throw new Error('Choose a PDF, Office document, text file or JPEG/PNG/GIF/WebP image.');
  const limit = (extension === 'pptx' ? 500 : 25) * 1024 * 1024;
  if (!Number.isSafeInteger(file.size) || file.size <= 0) throw new Error('This file is empty or its size could not be read.');
  if (file.size > limit) throw new Error(`${name} exceeds the ${extension === 'pptx' ? '500' : '25'} MB limit.`);
  return {...file, name, contentType: DOCUMENT_MIME[extension]};
}

// Each staged entry retains its key after a successful PUT. Finalization retries
// reuse that key (the server deduplicates it), avoiding repeat uploads.
export async function uploadAttachments({patientId, uid, entries, existingCount = 0, existingKeys = [], api, putFile, ensureCurrent, onChange = () => {}}) {
  if (typeof patientId !== 'string' || !patientId || ['.', '..'].includes(patientId) || patientId.includes('/')) throw new Error('This patient is unavailable.');
  if (!entries.length || entries.length > 10) throw new Error('Select between 1 and 10 attachments.');
  const unattached = entries.filter(entry => !entry.attached);
  if (existingCount + unattached.filter(entry => !existingKeys.includes(entry.uploaded?.s3Key)).length > 50) throw new Error('A patient can have at most 50 documents.');
  for (const entry of unattached) {
    validateAttachment(entry);
    if (!DOCUMENT_TYPES.some(([value]) => value === entry.type)) throw new Error('Choose a document category for every attachment.');
  }
  for (const entry of unattached) {
    ensureCurrent();
    const ensureEntry = () => { ensureCurrent(); if (entry.cancelled) throw new Error('The attachment was cancelled.'); };
    ensureEntry();
    onChange(entry, {error: '', state: 'uploading', progress: entry.uploaded ? 100 : 0});
    try {
      if (!entry.uploaded) {
        const result = await api('/api/upload-url', {method: 'POST', body: JSON.stringify({fileName: entry.name, contentType: entry.contentType, expectedSize: entry.size})});
        ensureCurrent();
        if (!ownsFile(result.key, uid) || !isSafeUrl(result.presignedPutUrl, 'production')) throw new Error('The upload destination could not be verified.');
        await putFile(result.presignedPutUrl, entry, progress => { ensureEntry(); onChange(entry, {progress}); }, ensureEntry);
        ensureCurrent();
        entry.uploaded = {name: entry.name, size: entry.size, contentType: entry.contentType, s3Key: result.key,
          presignedUrl: result.presignedGetUrl || '', presignedUrlExpiresAt: result.presignedUrlExpiresAt || ''};
      }
      ensureEntry();
      onChange(entry, {state: 'attaching', progress: 100});
      await api(`/api/patients/${encodeURIComponent(patientId)}/documents`, {method: 'POST', body: JSON.stringify({documents: [{...entry.uploaded, type: entry.type}]})});
      ensureEntry();
      entry.attached = true;
      onChange(entry, {state: 'attached', progress: 100});
    } catch (error) {
      ensureCurrent(); onChange(entry, {state: 'failed', error: error.message || 'The upload failed. Please retry.'}); throw error;
    }
  }
  return entries.filter(entry => entry.attached).length;
}
