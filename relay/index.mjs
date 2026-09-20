// Rentnode relay - turns Vast.ai's marketplace into real supply on the shelf.
//
// One process, four jobs, all idempotent so a restart never double-acts:
//   sync    every SYNC_MIN minutes, mirror a curated set of Vast machine types
//           onto the contract as listings owned by this relay's key, priced at
//           Vast's price plus MARGIN. Existing listings are repriced, not
//           duplicated.
//   watch   poll leaseCount; for each new lease on one of our listings, rent a
//           matching instance on Vast, attach a fresh ssh key, and remember
//           {leaseId -> instanceId, key}. If Vast has nothing, close the lease
//           at once so the renter gets every cent back.
//   serve   an HTTP endpoint the listing points at. A renter signs a message
//           with the wallet that paid; the relay checks the signer against
//           lease.renter on-chain and returns the ssh host, port and private key.
//   settle  claim() what has accrued, and when a lease is closed on-chain or its
//           runway hits zero, destroy the instance.
//
// What this is not: it is not the contract's business. The contract still
// only settles money. The relay is a provider like any other - one that
// happens to fulfil through Vast - and everything it lists says so in the spec.

import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import { WebSocketServer } from "ws";
import { createPublicClient, createWalletClient, http, parseUnits, encodeFunctionData, verifyMessage, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";

// ----------------------------------------------------------------- config
const env = (k, d) => process.env[k] ?? d;
const VAST_KEY = env("VAST_API_KEY");
const RELAY_KEY = env("RELAY_PRIVATE_KEY");
const MARKET = env("MARKET_ADDRESS", "0xd172e6Aa54e2D04F4168a339B63F284c99162D9d");
const RPC = env("RPC_URL", "https://rpc.mainnet.chain.robinhood.com");
const MARGIN = Number(env("MARGIN", "0.15"));
const PORT = Number(env("PORT", "8787"));
const PUBLIC_URL = env("PUBLIC_URL", `http://localhost:${PORT}`);
const SYNC_MIN = Number(env("SYNC_MIN", "60"));
const DATA = env("DATA_DIR", "./data");
if (!VAST_KEY || !RELAY_KEY) { console.error("VAST_API_KEY and RELAY_PRIVATE_KEY are required"); process.exit(1); }

// The shelf we curate. Each entry is one Vast search; the cheapest verified
// offer sets the price. Kind matches the contract enum: 0 GPU, 1 CPU.
const CATALOG = [
  // consumer
  { key: "rtx5090", kind: 0, gpu: "RTX 5090", spec: "RTX 5090 / 32GB / via Vast.ai", minVram: 32 },
  { key: "rtx4090", kind: 0, gpu: "RTX 4090", spec: "RTX 4090 / 24GB / via Vast.ai", minVram: 24 },
  { key: "rtx3090", kind: 0, gpu: "RTX 3090", spec: "RTX 3090 / 24GB / via Vast.ai", minVram: 24 },
  { key: "rtx3080", kind: 0, gpu: "RTX 3080", spec: "RTX 3080 / 10GB / via Vast.ai", minVram: 10 },
  { key: "rtx3070", kind: 0, gpu: "RTX 3070", spec: "RTX 3070 / 8GB / via Vast.ai", minVram: 8 },
  { key: "rtx3060", kind: 0, gpu: "RTX 3060", spec: "RTX 3060 / 12GB / via Vast.ai", minVram: 12 },
  // workstation
  { key: "a6000",   kind: 0, gpu: "RTX A6000", spec: "RTX A6000 / 48GB / via Vast.ai", minVram: 48 },
  { key: "l40s",    kind: 0, gpu: "L40S", spec: "L40S / 48GB / via Vast.ai", minVram: 48 },
  // datacenter
  { key: "a100",    kind: 0, gpu: "A100 SXM4", spec: "A100 SXM4 / 80GB / via Vast.ai", minVram: 80 },
  { key: "a100p40", kind: 0, gpu: "A100 PCIE", spec: "A100 PCIE / 40GB / via Vast.ai", minVram: 40 },
  { key: "v100",    kind: 0, gpu: "Tesla V100", spec: "Tesla V100 / 16GB / via Vast.ai", minVram: 16 },
  { key: "h100",    kind: 0, gpu: "H100 SXM", spec: "H100 SXM / 80GB / via Vast.ai", minVram: 80 },
  { key: "h100p",   kind: 0, gpu: "H100 PCIE", spec: "H100 PCIE / 80GB / via Vast.ai", minVram: 80 },
];
const IMAGE = "pytorch/pytorch:2.4.0-cuda12.4-cudnn9-runtime";

// ------------------------------------------------------------------ chain
const abi = [
  { type: "function", name: "list", stateMutability: "nonpayable", inputs: [{ type: "uint8" }, { type: "uint96" }, { type: "string" }, { type: "string" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "updateListing", stateMutability: "nonpayable", inputs: [{ type: "uint256" }, { type: "uint96" }, { type: "string" }, { type: "bool" }], outputs: [] },
  { type: "function", name: "claim", stateMutability: "nonpayable", inputs: [{ type: "uint256" }], outputs: [{ type: "uint96" }] },
  { type: "function", name: "close", stateMutability: "nonpayable", inputs: [{ type: "uint256" }], outputs: [] },
  { type: "function", name: "listingCount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "leaseCount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "earned", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "uint96" }] },
  { type: "function", name: "runway", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "uint64" }] },
  { type: "function", name: "listingsOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256[]" }] },
  { type: "function", name: "listingAt", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "tuple", components: [
    { name: "provider", type: "address" }, { name: "kind", type: "uint8" }, { name: "pricePerHour", type: "uint96" }, { name: "open", type: "bool" }, { name: "spec", type: "string" }, { name: "endpoint", type: "string" }] }] },
  { type: "function", name: "leaseAt", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "tuple", components: [
    { name: "listingId", type: "uint64" }, { name: "renter", type: "address" }, { name: "provider", type: "address" }, { name: "pricePerHour", type: "uint96" },
    { name: "funded", type: "uint96" }, { name: "claimed", type: "uint96" }, { name: "startAt", type: "uint64" }, { name: "closedAt", type: "uint64" }] }] },
];
const chain = { id: 4663, name: "RH Chain", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [RPC] } } };
const account = privateKeyToAccount(RELAY_KEY);
// public RPCs stall now and then; 30s beats viem's 10s default for writes
const pub = createPublicClient({ chain, transport: http(RPC, { timeout: 30_000, retryCount: 2 }) });
const wal = createWalletClient({ chain, transport: http(RPC, { timeout: 30_000, retryCount: 2 }), account });
const read = (fn, args = []) => pub.readContract({ address: MARKET, abi, functionName: fn, args });
const write = async (fn, args) => {
  const hash = await wal.sendTransaction({ to: MARKET, data: encodeFunctionData({ abi, functionName: fn, args }) });
  await pub.waitForTransactionReceipt({ hash });
  return hash;
};

// ------------------------------------------------------------------ state
mkdirSync(DATA, { recursive: true });
const STATE = `${DATA}/state.json`;
const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : { listings: {}, leases: {}, seenLeases: 0 };
const save = () => writeFileSync(STATE, JSON.stringify(state, null, 2));

// ------------------------------------------------------------------- vast
const vast = async (path, init = {}) => {
  const r = await fetch(`https://console.vast.ai/api/v0${path}`, {
    ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${VAST_KEY}`, ...(init.headers ?? {}) },
  });
  if (!r.ok) throw new Error(`vast ${path}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
};
/** Cheapest verified, rentable on-demand offer for a GPU model. */
async function cheapestOffer(c) {
  const q = { verified: { eq: true }, rentable: { eq: true }, gpu_name: { eq: c.gpu }, num_gpus: { eq: 1 }, gpu_ram: { gte: c.minVram * 1024 }, reliability2: { gte: 0.95 }, order: [["dph_total", "asc"]], type: "on-demand" };
  const j = await vast(`/bundles/?q=${encodeURIComponent(JSON.stringify(q))}`);
  return (j.offers ?? [])[0] ?? null;
}
const sshKeypair = (leaseId) => {
  const f = `${DATA}/lease-${leaseId}`;
  if (!existsSync(f)) execFileSync("ssh-keygen", ["-t", "ed25519", "-N", "", "-C", `rentnode-lease-${leaseId}`, "-f", f]);
  return { priv: readFileSync(f, "utf8"), pub: readFileSync(`${f}.pub`, "utf8").trim() };
};

// ------------------------------------------------------------------- sync
async function sync() {
  const mine = new Set((await read("listingsOf", [account.address])).map(Number));
  for (const c of CATALOG) {
    const offer = await cheapestOffer(c).catch((e) => (console.warn(`[sync] ${c.key}: ${e.message}`), null));
    const price = offer ? parseUnits((offer.dph_total * (1 + MARGIN)).toFixed(6), 6) : 0n;
    const endpoint = `${PUBLIC_URL}/lease`;
    const id = state.listings[c.key];
    if (id !== undefined && mine.has(id)) {
      const cur = await read("listingAt", [BigInt(id)]);
      const open = !!offer;
      // endpoint is compared too, so moving the relay to a new host relists
      if (cur.pricePerHour !== price || cur.open !== open || cur.endpoint !== endpoint) {
        await write("updateListing", [BigInt(id), open ? price : cur.pricePerHour, endpoint, open]);
        console.log(`[sync] ${c.key} #${id} -> ${open ? formatUnits(price, 6) + " USDG/hr" : "closed (no supply)"}`);
      }
    } else if (offer) {
      const before = Number(await read("listingCount"));
      await write("list", [c.kind, price, c.spec, endpoint]);
      state.listings[c.key] = before; save();
      console.log(`[sync] listed ${c.key} as #${before} at ${formatUnits(price, 6)} USDG/hr`);
    }
  }
}

// ------------------------------------------------------------------ watch
async function watch() {
  const n = Number(await read("leaseCount"));
  for (let id = state.seenLeases; id < n; id++) {
    const l = await read("leaseAt", [BigInt(id)]);
    if (l.provider.toLowerCase() !== account.address.toLowerCase()) continue;
    if (state.leases[id]) continue;
    const key = Object.entries(state.listings).find(([, lid]) => lid === Number(l.listingId))?.[0];
    const c = CATALOG.find((x) => x.key === key);
    try {
      const offer = c && (await cheapestOffer(c));
      if (!offer) throw new Error("no supply on Vast right now");
      const kp = sshKeypair(id);
      const inst = await vast(`/asks/${offer.id}/`, { method: "PUT", body: JSON.stringify({
        client_id: "me", image: IMAGE, disk: 40, runtype: "ssh", label: `rentnode-lease-${id}`,
        onstart: `mkdir -p ~/.ssh && echo '${kp.pub}' >> ~/.ssh/authorized_keys`,
      }) });
      state.leases[id] = { instanceId: inst.new_contract, renter: l.renter, since: Date.now(), ssh: null }; save();
      console.log(`[watch] lease #${id} -> vast instance ${inst.new_contract}`);
    } catch (e) {
      // Nothing to give the renter: close now, they get every cent back.
      console.warn(`[watch] lease #${id} cannot be fulfilled (${e.message}); closing`);
      await write("close", [BigInt(id)]).catch((x) => console.error(x.message));
      state.leases[id] = { failed: e.message }; save();
    }
  }
  state.seenLeases = n; save();

  // fill in ssh details once the instance is up
  const running = Object.entries(state.leases).filter(([, v]) => v.instanceId && !v.ssh);
  if (running.length) {
    const all = (await vast("/instances/")).instances ?? [];
    for (const [id, v] of running) {
      const i = all.find((x) => x.id === v.instanceId);
      if (i?.ssh_host && i.actual_status === "running") { v.ssh = { host: i.ssh_host, port: i.ssh_port, user: "root" }; save(); console.log(`[watch] lease #${id} ssh ready`); }
    }
  }
}

// ----------------------------------------------------------------- settle
async function settle() {
  for (const [id, v] of Object.entries(state.leases)) {
    if (!v.instanceId || v.done) continue;
    const l = await read("leaseAt", [BigInt(id)]);
    const runway = Number(await read("runway", [BigInt(id)]));
    if (l.closedAt !== 0n || runway === 0) {
      await vast(`/instances/${v.instanceId}/`, { method: "DELETE" }).catch((e) => console.warn(e.message));
      if (l.closedAt === 0n) await write("close", [BigInt(id)]).catch((e) => console.warn(e.message));
      v.done = true; save(); console.log(`[settle] lease #${id} ended, instance destroyed`);
      continue;
    }
    const owed = Number(await read("earned", [BigInt(id)])) / 1e6 - Number(l.claimed) / 1e6;
    if (owed >= 1) { await write("claim", [BigInt(id)]); console.log(`[settle] claimed ${owed.toFixed(2)} USDG on #${id}`); }
  }
}

// ------------------------------------------------------------------ serve
// GET /lease/:id   headers x-sig, x-msg where msg = "rentnode lease <id> <unix minute>"
// GET /probe/:listingId   live stats of the Vast offer behind a listing, no auth
// WS  /term/:leaseId?msg=&sig=   a shell on the instance, same signature as /lease

/** Is (msg, sig) a fresh signature by the renter of lease `id`? Returns the
 *  lease or an {code, error}. Shared by the access endpoint and the terminal. */
async function renterOf(id, msg, sig) {
  if (!sig || !msg || !msg.startsWith(`rentnode lease ${id} `)) return { code: 400, error: "sign 'rentnode lease <id> <unix minute>' with the renting wallet" };
  if (Math.abs(Date.now() / 60000 - Number(msg.split(" ").pop())) > 5) return { code: 401, error: "signature expired" };
  const l = await read("leaseAt", [BigInt(id)]).catch(() => null);
  if (!l) return { code: 404, error: "no such lease" };
  if (!(await verifyMessage({ address: l.renter, message: msg, signature: sig }))) return { code: 403, error: "not the renter" };
  return { lease: l };
}

// probe results are cached a minute so a busy detail page cannot hammer Vast
const probeCache = new Map();
async function probe(listingId) {
  const hit = probeCache.get(listingId);
  if (hit && Date.now() - hit.at < 60_000) return hit.data;
  const key = Object.entries(state.listings).find(([, lid]) => lid === listingId)?.[0];
  const c = CATALOG.find((x) => x.key === key);
  if (!c) return null;
  const o = await cheapestOffer(c);
  const data = !o ? { available: false } : {
    available: true, gpu: o.gpu_name, vram_gb: Math.round(o.gpu_ram / 1024), gpus: o.num_gpus,
    cpu: o.cpu_name, cores: Math.round(o.cpu_cores_effective ?? o.cpu_cores ?? 0), ram_gb: Math.round((o.cpu_ram ?? 0) / 1024), disk_gb: Math.round(o.disk_space ?? 0),
    down_mbps: Math.round(o.inet_down ?? 0), up_mbps: Math.round(o.inet_up ?? 0), reliability: Math.round((o.reliability2 ?? 0) * 1000) / 10,
    dlperf: Math.round(o.dlperf ?? 0), cuda: o.cuda_max_good, driver: o.driver_version, region: o.geolocation, verified: o.verification === "verified" || !!o.verified,
    vast_usd_hr: Math.round(o.dph_total * 1000) / 1000, checked_at: new Date().toISOString(),
  };
  probeCache.set(listingId, { at: Date.now(), data });
  return data;
}

const server = createServer(async (req, res) => {
  const json = (code, body) => { res.writeHead(code, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "x-sig,x-msg" }); res.end(JSON.stringify(body)); };
  if (req.method === "OPTIONS") return json(204, {});
  const p = req.url.match(/^\/probe\/(\d+)$/);
  if (p) {
    const data = await probe(Number(p[1])).catch((e) => ({ error: e.message }));
    return json(data ? 200 : 404, data ?? { error: "not a relay listing" });
  }
  const m = req.url.match(/^\/lease\/(\d+)$/);
  if (!m) return json(200, { relay: "rentnode", provider: account.address, listings: state.listings });
  const id = m[1];
  const r = await renterOf(id, req.headers["x-msg"], req.headers["x-sig"]);
  if (r.error) return json(r.code, { error: r.error });
  const v = state.leases[id];
  if (!v?.instanceId) return json(409, { error: v?.failed ?? "not provisioned yet" });
  if (!v.ssh) return json(202, { status: "booting", retryIn: 30 });
  return json(200, { ...v.ssh, privateKey: sshKeypair(id).priv, note: "ssh -i key -p PORT root@HOST" });
});

// ---------------------------------------------------------------- terminal
// The browser speaks xterm over a websocket; the relay runs the system ssh
// with the lease's own key and pipes bytes both ways. No pty library: -tt
// makes the remote side allocate one. Text frames are keystrokes, and a
// frame starting with \x01 carries "cols rows" for a resize.
const wss = new WebSocketServer({ noServer: true });
server.on("upgrade", async (req, sock, head) => {
  const u = new URL(req.url, "http://x");
  const m = u.pathname.match(/^\/term\/(\d+)$/);
  const deny = (code, text) => { sock.write(`HTTP/1.1 ${code} ${text}\r\n\r\n`); sock.destroy(); };
  if (!m) return deny(404, "Not Found");
  const id = m[1];
  const r = await renterOf(id, u.searchParams.get("msg"), u.searchParams.get("sig"));
  if (r.error) return deny(r.code, r.error);
  if (r.lease.closedAt !== 0n) return deny(410, "lease closed");
  const v = state.leases[id];
  if (!v?.ssh) return deny(409, "not ready");
  wss.handleUpgrade(req, sock, head, (ws) => {
    const keyFile = `${DATA}/lease-${id}`;
    const ssh = spawn("ssh", ["-tt", "-i", keyFile, "-p", String(v.ssh.port), "-o", "StrictHostKeyChecking=no", "-o", `UserKnownHostsFile=${process.platform === "win32" ? "NUL" : "/dev/null"}`, "-o", "LogLevel=ERROR", `${v.ssh.user}@${v.ssh.host}`]);
    const out = (d) => { if (ws.readyState === ws.OPEN) ws.send(d); };
    ssh.stdout.on("data", out); ssh.stderr.on("data", out);
    ssh.on("close", (code) => { out(`\r\n[connection closed${code ? ` (${code})` : ""}]\r\n`); ws.close(); });
    ws.on("message", (d) => {
      const s = d.toString();
      if (s.charCodeAt(0) === 1) { const [c, r_] = s.slice(1).split(" "); ssh.stdin.write(`stty cols ${Number(c) || 100} rows ${Number(r_) || 30}\n`); return; }
      ssh.stdin.write(s);
    });
    ws.on("close", () => ssh.kill());
    console.log(`[term] lease #${id} shell opened`);
  });
});

server.listen(PORT, () => console.log(`[serve] ${PUBLIC_URL}/lease/:id  /probe/:listingId  ws /term/:leaseId`));

// ------------------------------------------------------------------- loop
const tick = async (name, fn) => { try { await fn(); return true; } catch (e) { console.error(`[${name}]`, e.message.split("\n")[0]); return false; } };
console.log(`relay ${account.address} on ${MARKET}, margin ${MARGIN * 100}%`);
// a failed sync (RPC stall, Vast hiccup) retries in 2 minutes, not an hour
const syncLoop = async () => { const ok = await tick("sync", sync); setTimeout(syncLoop, (ok ? SYNC_MIN : 2) * 60_000); };
await syncLoop();
setInterval(() => tick("watch", watch), 15_000);
setInterval(() => tick("settle", settle), 60_000);
