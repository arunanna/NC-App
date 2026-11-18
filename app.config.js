const fs = require('node:fs');
const path = require('node:path');

module.exports = ({ config }) => {
  const filename = path.join(__dirname, 'config/local.json');
  let local = {};
  if (fs.existsSync(filename)) local = JSON.parse(fs.readFileSync(filename, 'utf8'));
  const firebase = Object.fromEntries(['apiKey', 'authDomain', 'projectId', 'appId'].map(key => [key, typeof local.firebase?.[key] === 'string' ? local.firebase[key] : '']));
  const expoProjectId = typeof local.expoProjectId === 'string' && /^[a-f0-9-]{36}$/i.test(local.expoProjectId) ? local.expoProjectId : '';
  const androidGoogleServicesFile = typeof local.androidGoogleServicesFile === 'string' ? local.androidGoogleServicesFile : '';
  return { ...config, ...(typeof local.expoOwner === 'string' && local.expoOwner ? {owner: local.expoOwner} : {}), name: 'NeuroClarity', slug: 'neuroclarity-mobile', version: '0.1.0', scheme: 'neuroclarity', orientation: 'portrait', userInterfaceStyle: 'light',
    icon: './assets/brand-icon.png',
    ios: { supportsTablet: true, bundleIdentifier: 'com.neuroclarity.doctors', config: { usesNonExemptEncryption: false } },
    android: { package: 'com.neuroclarity.doctors', ...(androidGoogleServicesFile ? {googleServicesFile: androidGoogleServicesFile} : {}), adaptiveIcon: { foregroundImage: './assets/brand-icon.png', backgroundColor: '#F7F8F5' } },
    web: { favicon: './assets/brand-icon.png', name: 'NeuroClarity' },
    plugins: ['expo-secure-store', ['expo-image-picker', {cameraPermission: 'Allow NeuroClarity to photograph documents to attach to a patient.', photosPermission: 'Allow NeuroClarity to select clinical document photos.', microphonePermission: false}], ['expo-notifications', {defaultChannel: 'patient-status'}]],
    extra: { eas: {projectId: expoProjectId || undefined}, mobile: { expoProjectId, pushAndroidConfigured: !!androidGoogleServicesFile, environment: typeof local.environment === 'string' ? local.environment : 'demo',
      apiBaseUrl: typeof local.apiBaseUrl === 'string' ? local.apiBaseUrl : '',
      passwordResetUrl: typeof local.passwordResetUrl === 'string' ? local.passwordResetUrl : '', firebase,
      productionBuild: process.env.NC_MOBILE_PRODUCTION_BUILD === '1' } },
  };
};
