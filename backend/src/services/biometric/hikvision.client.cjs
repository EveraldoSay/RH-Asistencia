const DigestFetch = require('digest-fetch').default || require('digest-fetch');

// Crea un cliente digest-compatible con Hikvision ISAPI
function makeClient({ baseUrl, user, pass }) {
  const client = new DigestFetch(user, pass, { algorithm: 'MD5', basic: false });

  async function request(path, opts = {}) {
    const url = `${baseUrl}${path}`;
    const timeout = opts.timeout || 8000;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json; charset="UTF-8"',
        ...(opts.headers || {})
      };

      const res = await client.fetch(url, {
        method: opts.method || 'GET',
        headers,
        body: opts.body || undefined,
        signal: controller.signal
      });

      if (!res.ok) {
        throw new Error(`${opts.method || 'GET'} ${url} -> ${res.status} ${res.statusText}`);
      }

      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return {
    get: (path) => request(path, { method: 'GET' }),
    post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
    fetch: request
  };
}

module.exports = { makeClient };
