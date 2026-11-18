import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { validateAttachment } from '../domain/attachments';

const ownedDirectory = () => `${FileSystem.cacheDirectory}nc-attachments/`;
export async function pickAttachments(source) {
  let result;
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error('Camera access is needed to photograph a document. Enable Camera in your device settings.');
    result = await ImagePicker.launchCameraAsync({mediaTypes: ['images'], quality: 0.9, exif: false, base64: false});
  } else if (source === 'photos') {
    result = await ImagePicker.launchImageLibraryAsync({mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 10, quality: 0.9, exif: false, base64: false, preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible});
  } else result = await DocumentPicker.getDocumentAsync({type: '*/*', multiple: true, copyToCacheDirectory: true});
  if (result.canceled) return [];
  const created = [];
  try {
    await FileSystem.makeDirectoryAsync(ownedDirectory(), {intermediates: true});
    for (const [index, asset] of result.assets.entries()) {
      const name = asset.name || asset.fileName || `camera-photo-${Date.now()}-${index}.jpg`;
      const info = await FileSystem.getInfoAsync(asset.uri);
      const file = validateAttachment({name, size: info.size ?? asset.size ?? asset.fileSize});
      const uri = `${ownedDirectory()}${Date.now()}-${Math.random().toString(36).slice(2)}.${name.split('.').pop()}`;
      await FileSystem.copyAsync({from: asset.uri, to: uri});
      created.push({...file, uri, id: uri, type: ''});
    }
    return created;
  } catch (error) { await Promise.all(created.map(cleanupAttachment)); throw error; }
  finally {
    // Pickers return app-cache copies (DocumentPicker explicitly copies first).
    // Never remove a provider URI or an original outside our cache.
    await Promise.all(result.assets.filter(asset => asset.uri.startsWith(FileSystem.cacheDirectory)).map(asset => FileSystem.deleteAsync(asset.uri, {idempotent: true}).catch(() => {})));
  }
}
export async function cleanupAttachment(file) {
  if (typeof file?.uri === 'string' && file.uri.startsWith(ownedDirectory())) await FileSystem.deleteAsync(file.uri, {idempotent: true}).catch(() => {});
}
export async function putAttachment(url, file, onProgress, ensureCurrent) {
  ensureCurrent();
  const task = FileSystem.createUploadTask(url, file.uri, {httpMethod: 'PUT', uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT, headers: {'Content-Type': file.contentType}}, event => {
    try { ensureCurrent(); onProgress(Math.round(event.totalBytesSent / event.totalBytesExpectedToSend * 100)); }
    catch { task.cancelAsync().catch(() => {}); }
  });
  file.cancelUpload = () => { task.cancelAsync().catch(() => {}); };
  let result;
  try { result = await task.uploadAsync(); } finally { delete file.cancelUpload; }
  ensureCurrent();
  if (!result || result.status < 200 || result.status >= 300) throw new Error('The file could not be uploaded. Check your connection and retry.');
}
