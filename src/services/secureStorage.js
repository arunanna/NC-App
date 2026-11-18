function chunks(value, maxBytes = 1500) {
  const result = []; let chunk = ''; let size = 0;
  for (const char of value) {
    const point = char.codePointAt(0);
    const bytes = point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
    if (size + bytes > maxBytes) { result.push(chunk); chunk = ''; size = 0; }
    chunk += char; size += bytes;
  }
  result.push(chunk); return result;
}

export function createSecureStorage(store) {
  const queues = new Map(); let serial = 0;
  const keyFor = key => `nc-auth-${Array.from(key).map(char => char.codePointAt(0).toString(16)).join('-')}`;
  const manifest = async key => {
    const value = await store.getItemAsync(key);
    if (!value) return null;
    let data;
    try { data = JSON.parse(value); } catch { await store.deleteItemAsync(key); return null; }
    if (!data || !/^[a-z0-9-]+$/.test(data.generation) || !Number.isInteger(data.count) || data.count < 1 || data.count > 128) {
      await store.deleteItemAsync(key); return null;
    }
    return data;
  };
  const clean = async (key, data) => {
    if (data) await Promise.all(Array.from({ length: data.count }, (_, i) => store.deleteItemAsync(`${key}-${data.generation}-${i}`).catch(() => {})));
  };
  const locked = (key, task) => {
    const next = (queues.get(key) || Promise.resolve()).catch(() => {}).then(task);
    queues.set(key, next);
    return next.finally(() => { if (queues.get(key) === next) queues.delete(key); });
  };
  return {
    getItem(key) { return locked(key, async () => {
      const safe = keyFor(key); const data = await manifest(safe);
      if (!data) return null;
      const parts = await Promise.all(Array.from({ length: data.count }, (_, i) => store.getItemAsync(`${safe}-${data.generation}-${i}`)));
      if (parts.some(part => part === null)) { await store.deleteItemAsync(safe); await clean(safe, data); return null; }
      return parts.join('');
    }); },
    setItem(key, value) { return locked(key, async () => {
      const safe = keyFor(key); const previous = await manifest(safe);
      const parts = chunks(value); const data = { generation: `${Date.now().toString(36)}-${(serial++).toString(36)}`, count: parts.length };
      if (parts.length > 128) throw new Error('Session is too large to save securely.');
      try {
        for (let i = 0; i < parts.length; i++) await store.setItemAsync(`${safe}-${data.generation}-${i}`, parts[i]);
        await store.setItemAsync(safe, JSON.stringify(data));
      } catch (error) { await clean(safe, data); throw error; }
      await clean(safe, previous);
    }); },
    removeItem(key) { return locked(key, async () => {
      const safe = keyFor(key); const data = await manifest(safe);
      await store.deleteItemAsync(safe); await clean(safe, data);
    }); },
  };
}
