export function normalizeControllerHost(host: string): string {
  const trimmed = host.trim();

  if (trimmed.startsWith('0.0.0.0:')) {
    return `127.0.0.1:${trimmed.slice('0.0.0.0:'.length)}`;
  }

  if (trimmed === '0.0.0.0') {
    return '127.0.0.1';
  }

  if (trimmed === '::' || trimmed === '[::]') {
    return '127.0.0.1';
  }

  return trimmed;
}
