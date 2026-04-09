/**
 * Cloudflare Pages Function — root path handler
 *
 * Browsers visiting https://fluxo.click  → serve landing page (index.html)
 * curl / wget hitting https://fluxo.click → serve install script (install.sh)
 *
 * This lets `curl -fsSL https://fluxo.click | sudo bash` work without any
 * path suffix while the landing page stays at the same URL for human visitors.
 */
export async function onRequest(context) {
  const ua = context.request.headers.get('User-Agent') || '';
  const isCli = /^(curl|wget|HTTPie|python-requests|libwww-perl)/i.test(ua);

  if (isCli) {
    // Fetch and return install.sh with the right content-type
    const url = new URL(context.request.url);
    url.pathname = '/install.sh';
    const resp = await fetch(url.toString(), { cf: { cacheTtl: 300 } });
    return new Response(resp.body, {
      status: resp.status,
      headers: {
        'Content-Type': 'text/x-shellscript; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  // Regular browser — let Pages serve index.html as normal
  return context.next();
}
