import { isSafeUrl } from '../domain/config.js';

export class ApiError extends Error {
  constructor(message, status = 0) { super(message); this.name = 'ApiError'; this.status = status; }
}

export function createApiClient({ baseUrl, getUser, getSessionKey = () => getUser(), fetchImpl = fetch, onUnauthorized = () => {} }) {
  return async function request(path, options = {}) {
    if (!path.startsWith('/api/') || path.includes('://')) throw new ApiError('Invalid API path');
    const user = getUser();
    const sessionKey = getSessionKey();
    const isCurrent = () => getUser() === user && getSessionKey() === sessionKey;
    if (!user) throw new ApiError('Please sign in again.', 401);
    const call = async forceRefresh => {
      const token = await user.getIdToken(forceRefresh);
      if (!isCurrent()) throw new ApiError('Your session has changed.', 401);
      return fetchImpl(`${baseUrl}${path}`, { ...options, redirect: 'error', headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers, Authorization: `Bearer ${token}`,
      } });
    };
    let response;
    try {
      response = await call(false);
      if (response.status === 401) response = await call(true);
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      if (String(error.code || '').startsWith('auth/')) { if (isCurrent()) onUnauthorized(); throw new ApiError('Please sign in again.', 401); }
      throw error instanceof ApiError ? error : new ApiError('Unable to connect. Check your connection and try again.');
    }
    if (!isCurrent()) throw new ApiError('Your session has changed.', 401);
    if ([401, 403].includes(response.status)) {
      onUnauthorized();
      throw new ApiError('Your access could not be verified. Please sign in again.', response.status);
    }
    const data = await response.json().catch(() => ({}));
    if (!isCurrent()) throw new ApiError('Your session has changed.', 401);
    if (!response.ok) throw new ApiError(response.status === 404 ? 'This record is unavailable.' : 'This request could not be completed. Please try again.', response.status);
    return data;
  };
}

export function registryPath({ search = '', status = 'all', cursor } = {}) {
  const params = new URLSearchParams({ search, status: status === 'in-progress' ? 'In Progress' : status,
    pageSize: '20', sortField: 'date', sortOrder: 'desc' });
  if (cursor) params.set('cursor', cursor);
  return `/api/patients?${params}`;
}

export function validDownloadUrl(value, environment) {
  if (!isSafeUrl(value, environment)) throw new ApiError('The document link is unavailable. Please try again.');
  return value;
}
