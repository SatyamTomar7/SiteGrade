import dns from 'dns/promises';
import net from 'net';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback'
]);

const IPV4_PRIVATE_RANGES = [
  ['0.0.0.0', '0.255.255.255'],
  ['10.0.0.0', '10.255.255.255'],
  ['100.64.0.0', '100.127.255.255'],
  ['127.0.0.0', '127.255.255.255'],
  ['169.254.0.0', '169.254.255.255'],
  ['172.16.0.0', '172.31.255.255'],
  ['192.0.0.0', '192.0.0.255'],
  ['192.0.2.0', '192.0.2.255'],
  ['192.168.0.0', '192.168.255.255'],
  ['198.18.0.0', '198.19.255.255'],
  ['198.51.100.0', '198.51.100.255'],
  ['203.0.113.0', '203.0.113.255'],
  ['224.0.0.0', '239.255.255.255'],
  ['240.0.0.0', '255.255.255.255']
];

const IPV6_BLOCKED_PREFIXES = [
  '::1',
  '::',
  'fc',
  'fd',
  'fe8',
  'fe9',
  'fea',
  'feb',
  'ff'
];

const ipv4ToNumber = (ip) => ip.split('.').reduce((acc, octet) => (acc * 256) + Number(octet), 0);

const isPrivateIpv4 = (ip) => {
  const numericIp = ipv4ToNumber(ip);

  return IPV4_PRIVATE_RANGES.some(([start, end]) => {
    return numericIp >= ipv4ToNumber(start) && numericIp <= ipv4ToNumber(end);
  });
};

const expandIpv6 = (ip) => {
  if (!ip.includes('::')) {
    return ip.split(':').map((segment) => segment.padStart(4, '0'));
  }

  const [left, right] = ip.split('::');
  const leftSegments = left ? left.split(':') : [];
  const rightSegments = right ? right.split(':') : [];
  const missingSegments = 8 - (leftSegments.length + rightSegments.length);

  return [
    ...leftSegments,
    ...Array.from({ length: missingSegments }, () => '0'),
    ...rightSegments
  ].map((segment) => segment.padStart(4, '0'));
};

const isPrivateIpv6 = (ip) => {
  const normalized = ip.toLowerCase();

  if (normalized.includes('%')) {
    return true;
  }

  if (normalized === '::' || normalized === '::1') {
    return true;
  }

  const expanded = expandIpv6(normalized).join('');

  return IPV6_BLOCKED_PREFIXES.some((prefix) => expanded.startsWith(prefix));
};

const isBlockedIp = (ip) => {
  const ipVersion = net.isIP(ip);

  if (ipVersion === 4) {
    return isPrivateIpv4(ip);
  }

  if (ipVersion === 6) {
    return isPrivateIpv6(ip);
  }

  return true;
};

const assertSafeHostname = (hostname) => {
  const normalizedHostname = hostname.trim().toLowerCase();

  if (!normalizedHostname) {
    const error = new Error('URL hostname is required');
    error.statusCode = 400;
    throw error;
  }

  if (BLOCKED_HOSTNAMES.has(normalizedHostname) || normalizedHostname.endsWith('.local')) {
    const error = new Error('Local and internal addresses are not allowed');
    error.statusCode = 400;
    throw error;
  }

  return normalizedHostname;
};

export const assertSafeAnalysisUrl = async (inputUrl) => {
  let parsedUrl;

  try {
    parsedUrl = new URL(inputUrl);
  } catch {
    const error = new Error('Invalid URL format provided');
    error.statusCode = 400;
    throw error;
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    const error = new Error('Only http and https URLs are allowed');
    error.statusCode = 400;
    throw error;
  }

  const hostname = assertSafeHostname(parsedUrl.hostname);

  if (net.isIP(hostname)) {
    if (isBlockedIp(hostname)) {
      const error = new Error('Private, reserved, and loopback IP addresses are not allowed');
      error.statusCode = 400;
      throw error;
    }

    return parsedUrl.toString();
  }

  let resolvedAddresses;

  try {
    resolvedAddresses = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    const error = new Error('Unable to resolve the provided hostname');
    error.statusCode = 400;
    throw error;
  }

  if (!resolvedAddresses.length) {
    const error = new Error('Unable to resolve the provided hostname');
    error.statusCode = 400;
    throw error;
  }

  const hasBlockedAddress = resolvedAddresses.some(({ address }) => isBlockedIp(address));

  if (hasBlockedAddress) {
    const error = new Error('Private, reserved, and loopback network targets are not allowed');
    error.statusCode = 400;
    throw error;
  }

  return parsedUrl.toString();
};
