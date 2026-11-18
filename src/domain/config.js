export const EMPTY_CONFIG = {
  environment: 'demo',
  apiBaseUrl: '',
  passwordResetUrl: '',
  firebase: { apiKey: '', authDomain: '', projectId: '', appId: '' },
};

export function isSafeUrl(value, environment = 'development') {
  try {
    const url = new URL(value);
    if (url.username || url.password) return false;
    if (url.protocol === 'https:') return true;
    return environment === 'development' && url.protocol === 'http:'
      && ['localhost', '127.0.0.1', '[::1]', '10.0.2.2'].includes(url.hostname);
  } catch { return false; }
}

export function resolveConfig(input = {}) {
  const environment = input.environment || 'demo';
  const config = { ...EMPTY_CONFIG, environment, apiBaseUrl: String(input.apiBaseUrl || '').replace(/\/+$/, ''),
    expoProjectId: typeof input.expoProjectId === 'string' && /^[a-f0-9-]{36}$/i.test(input.expoProjectId) ? input.expoProjectId : '',
    pushAndroidConfigured: input.pushAndroidConfigured === true,
    passwordResetUrl: String(input.passwordResetUrl || ''), firebase: { ...EMPTY_CONFIG.firebase, ...input.firebase } };
  if (environment === 'demo') return { ...config, connected: false, error: null };
  if (!['development', 'production'].includes(environment)) return { ...config, connected: false, error: 'Choose demo or development in config/local.json.' };
  if (environment === 'production' && input.productionBuild !== true) return { ...config, connected: false, error: 'Production requires an explicitly authorized release build.' };
  if (!isSafeUrl(config.apiBaseUrl, environment)) return { ...config, connected: false, error: 'Set a valid HTTPS development API URL in config/local.json.' };
  if (Object.values(config.firebase).some(value => typeof value !== 'string' || !value.trim())) return { ...config, connected: false, error: 'Complete the public Firebase configuration in config/local.json.' };
  if (config.passwordResetUrl && !isSafeUrl(config.passwordResetUrl, environment)) return { ...config, connected: false, error: 'The password-reset function URL must use HTTPS.' };
  return { ...config, connected: true, error: null };
}
