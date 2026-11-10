// instrumentation.ts
export async function register() {
  const proxy = process.env.V2RAY_PROXY;

  if (!proxy) {
    return;
  }

  const { ProxyAgent, Socks5ProxyAgent, setGlobalDispatcher } = await import(
    /* webpackIgnore: true */ "undici"
  );

  // undici's ProxyAgent only speaks HTTP(S) proxies; SOCKS needs Socks5ProxyAgent.
  // Socks5ProxyAgent sends hostnames to the proxy (remote DNS), so socks5h:// maps to socks5://.
  const isSocks = /^socks(5h?)?:\/\//i.test(proxy);
  const agent = isSocks
    ? new Socks5ProxyAgent(proxy.replace(/^socks5h:/i, "socks5:"))
    : new ProxyAgent(proxy);

  setGlobalDispatcher(agent);

  console.log(`✅ Global VPN proxy enabled (${isSocks ? "SOCKS5" : "HTTP"})`);
}
