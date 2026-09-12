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
import { execFileSync } from "node:child_process";
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
  { key: "rtx4090", kind: 0, gpu: "RTX 4090", spec: "RTX 4090 / 24GB / via Vast.ai", minVram: 24 },
  { key: "rtx3090", kind: 0, gpu: "RTX 3090", spec: "RTX 3090 / 24GB / via Vast.ai", minVram: 24 },
  { key: "a100",    kind: 0, gpu: "A100 SXM4", spec: "A100 SXM4 / 80GB / via Vast.ai", minVram: 80 },
  { key: "l40s",    kind: 0, gpu: "L40S", spec: "L40S / 48GB / via Vast.ai", minVram: 48 },
  { key: "h100",    kind: 0, gpu: "H100 SXM", spec: "H100 SXM / 80GB / via Vast.ai", minVram: 80 },
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
const pub = createPublicClient({ chain, transport: http(RPC) });
const wal = createWalletClient({ chain, transport: http(RPC), account });
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
      if (cur.pricePerHour !== price || cur.open !== open) {
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
// GET /lease/:id  with headers x-sig and x-msg, where msg = "rentnode lease <id> <unix minute>"
createServer(async (req, res) => {
  const m = req.url.match(/^\/lease\/(\d+)$/);
  const json = (code, body) => { res.writeHead(code, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "x-sig,x-msg" }); res.end(JSON.stringify(body)); };
  if (req.method === "OPTIONS") return json(204, {});
  if (!m) return json(200, { relay: "rentnode", provider: account.address, listings: state.listings });
  const id = m[1], sig = req.headers["x-sig"], msg = req.headers["x-msg"];
  if (!sig || !msg || !msg.startsWith(`rentnode lease ${id} `)) return json(400, { error: "sign 'rentnode lease <id> <unix minute>' with the renting wallet" });
  if (Math.abs(Date.now() / 60000 - Number(msg.split(" ").pop())) > 5) return json(401, { error: "signature expired" });
  const l = await read("leaseAt", [BigInt(id)]).catch(() => null);
  if (!l) return json(404, { error: "no such lease" });
  if (!(await verifyMessage({ address: l.renter, message: msg, signature: sig }))) return json(403, { error: "not the renter" });
  const v = state.leases[id];
  if (!v?.instanceId) return json(409, { error: v?.failed ?? "not provisioned yet" });
  if (!v.ssh) return json(202, { status: "booting", retryIn: 30 });
  return json(200, { ...v.ssh, privateKey: sshKeypair(id).priv, note: "ssh -i key -p PORT root@HOST" });
}).listen(PORT, () => console.log(`[serve] ${PUBLIC_URL}/lease/:id`));

// ------------------------------------------------------------------- loop
const tick = async (name, fn) => { try { await fn(); } catch (e) { console.error(`[${name}]`, e.message); } };
console.log(`relay ${account.address} on ${MARKET}, margin ${MARGIN * 100}%`);
await tick("sync", sync);
setInterval(() => tick("sync", sync), SYNC_MIN * 60_000);
setInterval(() => tick("watch", watch), 15_000);
setInterval(() => tick("settle", settle), 60_000);
