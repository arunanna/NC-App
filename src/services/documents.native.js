import * as WebBrowser from 'expo-web-browser';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { createDocumentOpener } from './documentActions';

export const openDocument = createDocumentOpener({
  openBrowser: WebBrowser.openBrowserAsync,
  isSharingAvailable: Sharing.isAvailableAsync,
  downloadFile: FileSystem.downloadAsync,
  shareFile: Sharing.shareAsync,
  removeFile: FileSystem.deleteAsync,
  cacheDirectory: FileSystem.cacheDirectory,
});
