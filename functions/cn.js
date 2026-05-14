/**
 * Cloudflare Pages Function — /cn path handler
 *
 * curl / wget hitting https://fluxo.click/cn → serve install.sh with CN proxies pre-set
 * Browser visiting https://fluxo.click/cn   → redirect to landing page
 *
 * Usage: curl -fsSL https://fluxo.click/cn | bash
 */
export async function onRequest(context) {
  const ua = context.request.headers.get('User-Agent') || '';
  const isCli = /^(curl|wget|HTTPie|python-requests|libwww-perl)/i.test(ua);

  // Browser — redirect to landing page
  if (!isCli) {
    return Response.redirect(new URL('/', context.request.url).toString(), 302);
  }

  // Fetch install.sh from the same origin
  const url = new URL(context.request.url);
  url.pathname = '/install.sh';
  const resp = await fetch(url.toString(), { cf: { cacheTtl: 300 } });
  let script = await resp.text();

  // Inject default CN proxies right after `set -euo pipefail`
  script = script.replace(
    'set -euo pipefail',
    'set -euo pipefail\n\n# CN defaults — auto-injected by https://fluxo.click/cn\nGH_PROXY="${GH_PROXY:-https://ghfast.top/}"\nNPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmmirror.com}"'
  );

  return new Response(script, {
    status: resp.status,
    headers: {
      'Content-Type': 'text/x-shellscript; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
