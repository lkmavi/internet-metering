import { lookup } from 'node:dns/promises';
import ipaddr from 'ipaddr.js';
import { Agent, fetch as undiciFetch } from 'undici';

const MAX_REDIRECTS = 3;
const agent = new Agent({
  connections: 2,
  connect: {
    lookup(hostname, options, callback) {
      resolvePublicAddress(hostname).then(
        ({ address, family }) =>
          options.all ? callback(null, [{ address, family }]) : callback(null, address, family),
        (error) => callback(error),
      );
    },
  },
});

/** Only globally routed IP addresses may be used by the public web API. */
export function isPublicAddress(address) {
  if (!ipaddr.isValid(address)) return false;
  const parsed = ipaddr.parse(address);
  if (parsed.kind() === 'ipv6' && parsed.isIPv4MappedAddress())
    return isPublicAddress(parsed.toIPv4Address().toString());
  if (parsed.range() !== 'unicast') return false;
  if (parsed.kind() === 'ipv4') {
    const octets = parsed.octets;
    if (octets[0] === 0 || octets[0] >= 224) return false;
    if (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127) return false;
    if (octets[0] === 169 && octets[1] === 254) return false;
    if (octets[0] === 192 && octets[1] === 0 && octets[2] === 0) return false;
    if (octets[0] === 192 && octets[1] === 0 && octets[2] === 2) return false;
    if (octets[0] === 198 && octets[1] === 18) return false;
    if (octets[0] === 198 && octets[1] === 19) return false;
    if (octets[0] === 198 && octets[1] === 51 && octets[2] === 100) return false;
    if (octets[0] === 203 && octets[1] === 0 && octets[2] === 113) return false;
  }
  return true;
}

/** Validate both literal IPs and DNS results; the validated result is used for the connection. */
export async function resolvePublicAddress(hostname) {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  )
    throw new Error('Веб-интерфейс не разрешает внутренние адреса');
  if (ipaddr.isValid(host)) {
    if (!isPublicAddress(host)) throw new Error('Веб-интерфейс не разрешает внутренние адреса');
    return { address: host, family: ipaddr.parse(host).kind() === 'ipv4' ? 4 : 6 };
  }
  const answers = await lookup(host, { all: true });
  const publicAnswer = answers.find((answer) => isPublicAddress(answer.address));
  if (!publicAnswer || answers.some((answer) => !isPublicAddress(answer.address)))
    throw new Error('Веб-интерфейс не разрешает внутренние адреса');
  return publicAnswer;
}

/** Follow only validated HTTP redirects through a DNS-pinned connection. */
export async function fetchPublic(input, options = {}) {
  let url = new URL(input);
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    if (!['http:', 'https:'].includes(url.protocol))
      throw new Error('Поддерживаются только HTTP и HTTPS');
    await resolvePublicAddress(url.hostname);
    const response = await undiciFetch(url, { ...options, redirect: 'manual', dispatcher: agent });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get('location');
    await response.body?.cancel();
    if (!location || redirects === MAX_REDIRECTS) throw new Error('Слишком много перенаправлений');
    url = new URL(location, url);
  }
}
