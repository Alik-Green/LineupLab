/** Normalize a user-entered LAN address and warn about likely typos/non-LAN hosts. */
export function normalizeServerUrl(input: string): { url: string; warning: string | null } {
  const raw = input.trim();
  const url = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
  let host = '';
  try { host = new URL(url).hostname.replace(/^\[|\]$/g, ''); } catch { return { url, warning: 'Enter a valid address such as http://192.168.1.20:8765.' }; }
  const parts = host.split('.').map(Number);
  const privateV4 = parts.length === 4 && parts.every(n => Number.isInteger(n) && n >= 0 && n <= 255) && (parts[0] === 10 || (parts[0] === 192 && parts[1] === 168) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31));
  const local = host === 'localhost' || host.endsWith('.local') || /^f[cd][0-9a-f]{2}:/i.test(host) || /^fe80:/i.test(host);
  if (!privateV4 && !local) return { url, warning: 'This does not look like a private LAN address. Check the desktop address (home networks usually start 192.168., 10., or 172.16–31.). Do not expose sharing to the internet.' };
  return { url, warning: null };
}
