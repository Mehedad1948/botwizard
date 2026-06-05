// instrumentation.ts
export async function register() {
  const proxy = process.env.V2RAY_PROXY;

  if (!proxy) {
    return;
  }

  const { ProxyAgent, setGlobalDispatcher } = await import(/* webpackIgnore: true */ "undici");
  const agent = new ProxyAgent(proxy);

  setGlobalDispatcher(agent);

  console.log("✅ Global VPN proxy enabled");
}
