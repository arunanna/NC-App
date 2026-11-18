import {Platform} from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import {AndroidImportance, AndroidNotificationVisibility} from 'expo-notifications';

const INSTALLATION_KEY = 'nc-push-installation-v1';
const DISABLED_KEY = 'nc-push-disabled-v1';
const REVISION_KEY = 'nc-push-revision-v1';
let revisionQueue = Promise.resolve();
let installationQueue = Promise.resolve();
function getOrCreateInstallation(token) {
  const operation = installationQueue.catch(() => {}).then(async () => {
    let id = await installationId();
    if (!id) {
      id = `expo-${token.replace(/^[^[]*\[|\]$/g, '')}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      await SecureStore.setItemAsync(INSTALLATION_KEY, id);
    }
    return id;
  });
  installationQueue = operation; return operation;
}
export function nextRevision() {
  const operation = revisionQueue.catch(() => {}).then(async () => {
    const previous = Number(await SecureStore.getItemAsync(REVISION_KEY)) || 0;
    const next = Math.max(Date.now(), previous + 1);
    await SecureStore.setItemAsync(REVISION_KEY, String(next)); return next;
  });
  revisionQueue = operation; return operation;
}
export const installationId = () => SecureStore.getItemAsync(INSTALLATION_KEY);
export const isDisabled = async () => await SecureStore.getItemAsync(DISABLED_KEY) === '1';
export const setDisabled = value => SecureStore.setItemAsync(DISABLED_KEY, value ? '1' : '0');
export async function register(config, requestPermission) {
  if (Constants.executionEnvironment === 'storeClient') throw new Error('Push notifications require the installed NeuroClarity build. They are unavailable in Expo Go.');
  if (!Device.isDevice) throw new Error('Use an installed build on a physical device to enable push notifications.');
  if (!config.expoProjectId) throw new Error('Push setup is incomplete for this build. Configure the Expo project and rebuild the app.');
  if (Platform.OS === 'android' && !config.pushAndroidConfigured) throw new Error('Android push setup is incomplete. Add the Firebase Android registration file and rebuild the app.');
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('patient-status', {name: 'Patient status updates', importance: AndroidImportance.HIGH, lockscreenVisibility: AndroidNotificationVisibility.PRIVATE});
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && requestPermission && permission.canAskAgain) permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return null;
  let token;
  try { token = (await Notifications.getExpoPushTokenAsync({projectId: config.expoProjectId})).data; }
  catch { throw new Error('Push registration failed. Check your connection and the native push credentials for this build, then retry.'); }
  const id = await getOrCreateInstallation(token);
  return {token, installationId: id, platform: Platform.OS};
}
export function watchNotifications({getUid, onOpen, onReceived, onToken}) {
  Notifications.setNotificationHandler({handleNotification: async notification => {
    const own = notification.request.content.data?.uid === getUid();
    return {shouldShowBanner: own, shouldShowList: own, shouldPlaySound: own, shouldSetBadge: false};
  }});
  const received = Notifications.addNotificationReceivedListener(notification => onReceived(notification.request.content.data));
  const response = Notifications.addNotificationResponseReceivedListener(value => onOpen(value.notification.request.content.data));
  const tokens = Notifications.addPushTokenListener(() => onToken());
  Notifications.getLastNotificationResponseAsync().then(value => {
    if (value) { onOpen(value.notification.request.content.data); Notifications.clearLastNotificationResponseAsync().catch(() => {}); }
  }).catch(() => {});
  return () => { received.remove(); response.remove(); tokens.remove(); };
}
