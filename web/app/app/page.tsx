"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { encodeFunctionData, parseUnits } from "viem";
import { useWallet } from "../wallet.ts";
import { makeFormat } from "../../src/money.ts";
import { MARKET, USDG, USDG_DECIMALS, KINDS, marketAbi, erc20ApproveAbi, humanDuration } from "../../src/market.ts";
import type { Listing, Lease } from "../api/market/route.ts";
import { Icon, Mark, Arrow } from "../icons.tsx";
import { Typed } from "../type.tsx";
import { SITE_URL, DOCS_URL } from "../../src/site.ts";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
type Tab = "overview" | "market" | "leases" | "provide";

/* The console: a fixed rail on the left, a breadcrumb bar, a KPI strip, and
   the working surface. Everything on it is a contract read; the only numbers
   that are not are labelled as such. */

const NAV: { group: string; items: [Tab, string, string][] }[] = [
  { group: "Console", items: [["overview", "Overview", "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"]] },
  { group: "Resources", items: [
    ["market", "Machines", "M4 7h16v10H4zM4 11h16M8 15h3"],
    ["leases", "Leases", "M12 21a9 9 0 100-18 9 9 0 000 18M12 7v5.2l3.4 2"],
  ] },
  { group: "Operations", items: [["provide", "Provide", "M12 3v11M7.5 9.5l4.5 4.5 4.5-4.5M4 20h16"]] },
];

export default function App() {
  const wallet = useWallet();
  const fmt = useMemo(() => makeFormat("USD", 2), []);
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<{ deployed: boolean; listings: Listing[]; leases: Lease[]; usdg: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [menu, setMenu] = useState(false);
  const [at, setAt] = useState<number>(0);

  const load = useCallback(async (addr: string) => {
    try {
      const r = await fetch(`/api/market${addr ? `?address=${addr}` : ""}`);
      setData(await r.json()); setAt(Date.now());
    } catch { /* keep the last good read */ }
  }, []);
  useEffect(() => { void load(wallet.address ?? ""); }, [wallet.address, load]);
  useEffect(() => {
    const t = setInterval(() => void load(wallet.address ?? ""), 10_000);
    return () => clearInterval(t);
  }, [wallet.address, load]);
  useEffect(() => {
    if (!menu) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(false); };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [menu]);

  const done = (text: string) => { setMsg({ ok: true, text }); void load(wallet.address ?? ""); };
  const fail = (e: unknown) => {
    const m = e instanceof Error ? e.message : String(e);
    setMsg({ ok: false, text: /reject|denied/i.test(m) ? "You rejected the request." : /insufficient/i.test(m) ? "Not enough ETH for gas." : "Transaction failed." });
  };
  const send = (to: `0x${string}`, data_: `0x${string}`) => wallet.send({ to, data: data_ });

  const listings = data?.listings ?? [];
  const leases = data?.leases ?? [];
  const open = leases.filter((l) => !l.closedAt);
  const common = { fmt, busy, setBusy, send, done, fail, wallet, usdg: data?.usdg ?? 0 };
  const go = (t: Tab) => { setTab(t); setMsg(null); setPicked(null); setMenu(false); };
  const title = tab === "overview" ? "Overview" : tab === "market" ? (picked !== null ? "Machine" : "Machines") : tab === "leases" ? "Leases" : "Provide";

  return (
    <div className="dash">
      {/* ---- rail ---- */}
      <aside className={`rail${menu ? " open" : ""}`}>
        <a className="rail-brand" href={SITE_URL}><Mark /><span><b>Rentnode</b><small>Compute console</small></span></a>
        <div className="rail-search"><span>SEARCH</span><kbd>⌘K</kbd></div>
        <a className="btn sm mint rail-cta" href="#" onClick={(e) => { e.preventDefault(); go("provide"); }}>ADD A MACHINE</a>
        <nav className="rail-nav">
          {NAV.map((g) => (
            <div key={g.group}>
              <div className="rail-group">{g.group}</div>
              {g.items.map(([t, label, d]) => (
                <button key={t} className={tab === t ? "on" : ""} onClick={() => go(t)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square"><path d={d} /></svg>
                  {label}
                  {t === "leases" && open.length > 0 && <em>{open.length}</em>}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="rail-foot">
          <div className="rail-group">Contract</div>
          <a className="mono" href={`https://robinhoodchain.blockscout.com/address/${MARKET}`} target="_blank" rel="noreferrer">{MARKET ? short(MARKET) : "not deployed"} ↗</a>
          <a href={DOCS_URL} style={{ marginTop: 8 }}>Docs</a>
        </div>
      </aside>
      {menu && <button className="rail-veil" onClick={() => setMenu(false)} aria-label="Close menu" />}

      {/* ---- main ---- */}
      <div className="dash-main">
        <header className="topbar">
          <button className="topbar-burger" onClick={() => setMenu(true)} aria-label="Open menu"><i /><i /><i /></button>
          <div className="crumbs"><span>CONSOLE</span><i>›</i><span>RH:4663</span><i>›</i><b>{title.toUpperCase()}</b></div>
          <span className="sp" />
          <span className="topbar-env"><i /> PRODUCTION</span>
          <span className="topbar-env dim">{at ? `updated ${Math.max(0, Math.round((Date.now() - at) / 1000))}s ago` : "reading…"}</span>
          {wallet.address
            ? <button className="btn sm" onClick={() => wallet.disconnect()}>{short(wallet.address)}</button>
            : wallet.unavailable
              ? <a className="btn sm" href="https://metamask.io/download/" target="_blank" rel="noreferrer">Get a wallet</a>
              : <button className="btn sm primary" onClick={() => void wallet.connect()} disabled={wallet.busy}>{wallet.busy ? "…" : "Connect"}</button>}
        </header>

        <main className="dash-body">
          {msg && <div className={`msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</div>}
          {wallet.error && <div className="msg err">{wallet.error}</div>}
          {wallet.address && !wallet.chainOk && <div className="msg err">Your wallet is on another network. Switch it to RH Chain to sign anything here.</div>}
          {data && !data.deployed && <div className="msg err">The marketplace contract isn&apos;t deployed yet — the shelf fills the moment it is.</div>}

          {tab === "overview" && <Overview listings={listings} leases={leases} usdg={data?.usdg ?? 0} fmt={fmt} go={go} pick={(i) => { setTab("market"); setPicked(i); }} wallet={wallet} />}
          {tab === "market" && (
            picked !== null && listings[picked]
              ? <Detail l={listings[picked]} back={() => setPicked(null)} {...common} />
              : <Market listings={listings} pick={setPicked} fmt={fmt} />
          )}
          {tab === "leases" && <Leases leases={leases} {...common} />}
          {tab === "provide" && <Provide listings={listings} {...common} />}
        </main>
      </div>
    </div>
  );
}

type Common = {
  fmt: (n: number) => string; busy: string | null; setBusy: (s: string | null) => void;
  send: (to: `0x${string}`, d: `0x${string}`) => Promise<`0x${string}`>;
  done: (t: string) => void; fail: (e: unknown) => void;
  wallet: ReturnType<typeof useWallet>; usdg: number;
};

/** The KPI strip: six tiles, every one a count or a sum off the contract. */
function Kpis({ cells }: { cells: [string, string, string, string?][] }) {
  return (
    <div className="kpis">
      {cells.map(([k, v, sub, tone]) => (
        <div className={`kpi${tone ? ` ${tone}` : ""}`} key={k}>
          <span><i />{k}</span>
          <b>{v}</b>
          <small>{sub}</small>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- overview

function Overview({ listings, leases, usdg, fmt, go, pick, wallet }: {
  listings: Listing[]; leases: Lease[]; usdg: number; fmt: (n: number) => string;
  go: (t: Tab) => void; pick: (i: number) => void; wallet: ReturnType<typeof useWallet>;
}) {
  const open = listings.filter((l) => l.open);
  const live = leases.filter((l) => !l.closedAt);
  const held = live.reduce((s, l) => s + l.refundable, 0);
  const spent = leases.reduce((s, l) => s + l.earned, 0);
  const byKind = KINDS.map((k, i) => [k, listings.filter((l) => l.kind === i && l.open).length] as const);

  return (
    <>
      <div className="dash-head">
        <div>
          <h1 className="display sm"><Typed text="Infrastructure overview" /></h1>
          <p className="k" style={{ marginTop: 6 }}>{open.length} machines on the shelf · {live.length} leases running · read off the contract every 10s</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn sm" onClick={() => go("market")}>Browse machines</button>
          <button className="btn sm mint" onClick={() => go("provide")}>+ New listing</button>
        </div>
      </div>

      <Kpis cells={[
        ["Machines listed", String(open.length), `${listings.length - open.length} closed`],
        ["Kinds available", String(byKind.filter(([, n]) => n > 0).length), "of 4 categories"],
        ["Your leases", String(live.length), `${leases.length - live.length} closed`, live.length ? "ok" : undefined],
        ["Escrow held", fmt(held), "refundable now", held > 0 ? "warn" : undefined],
        ["Spent to date", fmt(spent), "to providers"],
        ["Wallet", fmt(usdg), wallet.address ? short(wallet.address) : "not connected"],
      ]} />

      <div className="ov-grid">
        <div className="card">
          <div className="card-head"><span className="k">Shelf health · {listings.length} listings</span><span className="k live">live</span></div>
          <div className="card-pad" style={{ gap: 14 }}>
            <div className="health">
              {listings.length === 0
                ? Array.from({ length: 48 }, (_, i) => <i key={i} className="empty" />)
                : listings.map((l) => <i key={l.id} className={l.open ? "ok" : "off"} title={l.spec} onClick={() => pick(l.id)} />)}
            </div>
            <div className="legend">
              <span><i className="ok" />Open <b>{open.length}</b></span>
              <span><i className="off" />Closed <b>{listings.length - open.length}</b></span>
              <span><i className="empty" />Empty slot</span>
            </div>
            <div className="specs" style={{ marginTop: 4 }}>
              {byKind.map(([k, n]) => <div className="spec" key={k}><span>{k}</span><b>{n} open</b></div>)}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><span className="k">Activity</span><button className="k linkish" onClick={() => go("leases")}>View all</button></div>
          <div className="card-pad" style={{ gap: 0 }}>
            {!wallet.address ? <div className="empty">Connect a wallet to see your activity.</div>
              : leases.length === 0 ? <div className="empty">No leases yet.</div>
              : [...leases].reverse().slice(0, 6).map((l) => (
                <div className="act" key={l.id}>
                  <span className="act-ic"><Icon kind={l.kind} size={18} still /></span>
                  <div><b>{l.closedAt ? "Closed" : "Running"} · {l.spec.split("/")[0]?.trim() || KINDS[l.kind]}</b><span>{fmt(l.pricePerHour)}/hr · {l.closedAt ? `paid ${fmt(l.earned)}` : `${humanDuration(l.runway)} left`}</span></div>
                  <span className={`chip ${l.closedAt ? "off" : "on"}`}>{l.closedAt ? "done" : "live"}</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-head"><span className="k">Recent machines</span><button className="k linkish" onClick={() => go("market")}>Open the market</button></div>
        <MachineTable rows={[...listings].reverse().slice(0, 6)} pick={pick} fmt={fmt} compact />
      </div>
    </>
  );
}

// ------------------------------------------------------------------ market

function MachineTable({ rows, pick, fmt, compact }: { rows: Listing[]; pick: (i: number) => void; fmt: (n: number) => string; compact?: boolean }) {
  if (rows.length === 0) return <div className="empty">Nothing listed yet. Anyone can add a machine from Provide — no gatekeeper, no deposit.</div>;
  return (
    <div className="tbl-wrap flat">
      <table className="tbl res">
        <thead><tr><th>Resource</th><th>Type</th><th>Status</th><th>Spec</th>{!compact && <th>Provider</th>}<th className="r">Cost / hr</th><th className="r">Per sec</th><th></th></tr></thead>
        <tbody>
          {rows.map((l, i) => (
            <tr key={l.id} onClick={() => pick(l.id)}>
              <td className="res-name"><span className="res-ic"><Icon kind={l.kind} size={20} i={i} /></span><div><b>{l.spec.split("/")[0]?.trim() || KINDS[l.kind]}</b><small className="mono">#{l.id}</small></div></td>
              <td className="mono">{KINDS[l.kind]}</td>
              <td><span className={`dot ${l.open ? "ok" : "off"}`} />{l.open ? "Available" : "Closed"}</td>
              <td className="dim">{l.spec}</td>
              {!compact && <td className="mono dim">{short(l.provider)}</td>}
              <td className="r mono">{fmt(l.pricePerHour)}</td>
              <td className="r mono dim">{(l.pricePerHour / 3600).toFixed(6)}</td>
              <td className="r"><span className="k">OPEN →</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* The shelf as cards: art, name, the spec split into chips, and one price
   that reads before anything else. */
function MachineCards({ rows, pick, fmt }: { rows: Listing[]; pick: (i: number) => void; fmt: (n: number) => string }) {
  if (rows.length === 0) return <div className="card"><div className="empty">Nothing listed yet. Anyone can add a machine from Provide — no gatekeeper, no deposit.</div></div>;
  return (
    <div className="mgrid">
      {rows.map((l, i) => {
        const parts = l.spec.split("/").map((s) => s.trim()).filter(Boolean);
        const name = parts[0] || KINDS[l.kind];
        return (
          <button key={l.id} className={`mcard${l.open ? "" : " closed"}`} onClick={() => pick(l.id)}>
            <div className="mcard-top">
              <span className="mcard-kind">{KINDS[l.kind]} · #{l.id}</span>
              <span className={`mcard-status ${l.open ? "ok" : "off"}`}><i />{l.open ? "Available" : "Closed"}</span>
            </div>
            <div className="mcard-art"><Icon kind={l.kind} size={64} i={i} /></div>
            <h4>{name}</h4>
            <div className="mcard-chips">{parts.slice(1).map((p) => <span key={p}>{p}</span>)}</div>
            <div className="mcard-foot">
              <div className="mcard-price"><b>{fmt(l.pricePerHour)}</b><span>USDG / hr · {(l.pricePerHour / 3600).toFixed(6)} per sec</span></div>
              <span className="btn primary sm">Rent →</span>
            </div>
            <span className="mcard-prov mono">{short(l.provider)}</span>
          </button>
        );
      })}
    </div>
  );
}

function Market({ listings, pick, fmt }: { listings: Listing[]; pick: (i: number) => void; fmt: (n: number) => string }) {
  const [kind, setKind] = useState(-1);
  const [openOnly, setOpenOnly] = useState(true);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"new" | "cheap" | "dear">("new");

  let rows = listings
    .filter((l) => (kind < 0 || l.kind === kind) && (!openOnly || l.open))
    .filter((l) => !q || `${l.spec} ${KINDS[l.kind]}`.toLowerCase().includes(q.toLowerCase()));
  rows = sort === "new" ? [...rows].reverse()
    : [...rows].sort((a, b) => sort === "cheap" ? a.pricePerHour - b.pricePerHour : b.pricePerHour - a.pricePerHour);

  return (
    <>
      <div className="dash-head">
        <div>
          <h1 className="display sm"><Typed text="Machines" /></h1>
          <p className="k" style={{ marginTop: 6 }}>{listings.length} resources · filtered to {rows.length}</p>
        </div>
      </div>

      <Kpis cells={[
        ["On the shelf", String(listings.filter((l) => l.open).length), "available now"],
        ["GPU", String(listings.filter((l) => l.kind === 0 && l.open).length), "listed"],
        ["CPU", String(listings.filter((l) => l.kind === 1 && l.open).length), "listed"],
        ["Storage", String(listings.filter((l) => l.kind === 2 && l.open).length), "listed"],
        ["Database", String(listings.filter((l) => l.kind === 3 && l.open).length), "listed"],
        ["Cheapest", listings.length ? fmt(Math.min(...listings.filter((l) => l.open).map((l) => l.pricePerHour))) : "—", "USDG / hr"],
      ]} />

      <div className="filters-row">
        <div className="inp" style={{ padding: "8px 12px", flex: 1, minWidth: 200 }}><input placeholder="Filter by name, spec, region…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="seg" style={{ flex: "none" }}>
          <button className={kind < 0 ? "on" : ""} onClick={() => setKind(-1)}>All</button>
          {KINDS.map((k, i) => <button key={k} className={kind === i ? "on" : ""} onClick={() => setKind(i)}>{k}</button>)}
        </div>
        <div className="seg" style={{ flex: "none" }}>
          {([["new", "Newest"], ["cheap", "Cheapest"], ["dear", "Priciest"]] as const).map(([v, l]) => (
            <button key={v} className={sort === v ? "on" : ""} onClick={() => setSort(v)}>{l}</button>
          ))}
        </div>
        <label className="switch"><input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} /><i />Available only</label>
      </div>

      <MachineCards rows={rows} pick={pick} fmt={fmt} />
    </>
  );
}

// ------------------------------------------------------------------ detail

function Detail({ l, back, fmt, busy, setBusy, send, done, fail, wallet, usdg }: Common & { l: Listing; back: () => void }) {
  const [hours, setHours] = useState(1);
  const cost = l.pricePerHour * hours;
  const perSec = l.pricePerHour / 3600;
  const parts = l.spec.split("/").map((s) => s.trim()).filter(Boolean);

  const rent = async () => {
    if (!MARKET || !wallet.address || cost <= 0) return;
    setBusy("Renting…");
    try {
      const raw = parseUnits(cost.toFixed(USDG_DECIMALS), USDG_DECIMALS);
      await send(USDG as `0x${string}`, encodeFunctionData({ abi: erc20ApproveAbi, functionName: "approve", args: [MARKET, raw] }));
      await send(MARKET, encodeFunctionData({ abi: marketAbi, functionName: "rent", args: [BigInt(l.id), raw] }));
      done("Leased. The meter is running — check the Leases tab.");
    } catch (e) { fail(e); } finally { setBusy(null); }
  };

  return (
    <>
      <button className="btn sm" onClick={back} style={{ marginBottom: 18 }}>← Back to market</button>
      <div className="shell detail">
        <div>
          <div className="card" style={{ display: "grid", placeItems: "center", minHeight: 260, marginBottom: 16 }}>
            <Icon kind={l.kind} size={120} i={1} />
          </div>
          <span className="k" style={{ display: "block", marginBottom: 8 }}>Specification</span>
          <div className="specs">
            {parts.slice(0, 4).map((p, i) => (
              <div className="spec" key={i}><span>{["Hardware", "Memory", "Region", "Extra"][i]}</span><b>{p}</b></div>
            ))}
          </div>
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-head"><span className="k">What the chain guarantees</span><span className="chip warn">off-chain hardware</span></div>
            <div className="card-pad">
            <p className="kicker" style={{ fontSize: 13.5, marginTop: 8 }}>
              Payment and refunds only. This contract never sees the machine — the spec above is
              a claim its provider makes, not something verified on-chain. Your protection is that
              you can close the lease at any second and take back every unspent cent.
            </p>
            </div>
          </div>
        </div>

        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span className={`tag ${l.open ? "live" : "done"}`}>{l.open ? "Available" : "Closed"}</span>
            <span style={{ fontSize: 12, color: "var(--dim)" }}>{KINDS[l.kind]} · {short(l.provider)}</span>
          </div>
          <h1 className="display sm">{l.spec.split("/")[0]?.trim() || KINDS[l.kind]}</h1>
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.035em", margin: "10px 0 20px" }}>
            {fmt(l.pricePerHour)}<span style={{ fontSize: 14, fontWeight: 500, color: "var(--faint)" }}> /hour</span>
          </div>

          <div className="card card-pad">
            <h3>Fund the lease</h3>
            <span className="k" style={{ display: "block", marginBottom: 8 }}>Hours to escrow</span>
            <div className="step" style={{ marginBottom: 16 }}>
              <button onClick={() => setHours((h) => Math.max(1, h - 1))} disabled={hours <= 1}>−</button>
              <input type="number" min={1} value={hours} onChange={(e) => setHours(Math.max(1, Math.floor(Number(e.target.value) || 1)))} />
              <button onClick={() => setHours((h) => h + 1)}>+</button>
            </div>
            <div className="kv"><span>Rate</span><b>{fmt(perSec)} /sec</b></div>
            <div className="kv"><span>Runway</span><b>{humanDuration(hours * 3600)}</b></div>
            <div className="kv"><span>In wallet</span><b>{fmt(usdg)}</b></div>
            <div className="total"><span>Escrow</span><b>{fmt(cost)}</b></div>
            <button className="btn primary wide" disabled={!MARKET || !l.open || !wallet.address || !!busy || cost > usdg + 1e-9} onClick={rent}>
              {busy ?? (!wallet.address ? "Connect wallet" : cost > usdg ? "Not enough USDG" : "Start the lease")}
              {!busy && wallet.address && cost <= usdg && <Arrow />}
            </button>
            <p className="kicker" style={{ fontSize: 12, marginTop: 12 }}>
              Stop whenever you like — you are refunded every second you did not use.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ access

/** For leases whose listing endpoint is a relay URL: sign a short message with
 *  the renting wallet and fetch the ssh details. The relay checks the signer
 *  against lease.renter on-chain, so nobody else can pull them. */
function Access({ l, wallet }: { l: Lease; wallet: ReturnType<typeof useWallet> }) {
  const [out, setOut] = useState<{ host?: string; port?: number; user?: string; privateKey?: string; status?: string; error?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const fetchAccess = async () => {
    setBusy(true); setOut(null);
    try {
      const msg = `rentnode lease ${l.id} ${Math.floor(Date.now() / 60000)}`;
      const sig = await wallet.sign(msg);
      const r = await fetch(`${l.endpoint.replace(/\/$/, "")}/${l.id}`, { headers: { "x-sig": sig, "x-msg": msg } });
      setOut(await r.json());
    } catch (e) { setOut({ error: e instanceof Error ? e.message : String(e) }); }
    finally { setBusy(false); }
  };
  return (
    <div className="access">
      <button className="btn sm mint" disabled={busy} onClick={fetchAccess}>{busy ? "…" : out?.host ? "Refresh access" : "Get access"}</button>
      {out?.error && <span className="k" style={{ color: "var(--rose)" }}>{out.error}</span>}
      {out?.status && <span className="k">{out.status} — try again in 30s</span>}
      {out?.host && (
        <div className="access-out">
          <div className="spec"><span>ssh</span><b className="mono">ssh -i lease-{l.id}.key -p {out.port} {out.user}@{out.host}</b></div>
          <details><summary className="k">private key · save as lease-{l.id}.key, chmod 600</summary><pre className="code">{out.privateKey}</pre></details>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ leases

function Leases({ leases, fmt, busy, setBusy, send, done, fail, wallet }: Common & { leases: Lease[] }) {
  const [topping, setTopping] = useState<Record<number, string>>({});
  const act = async (label: string, fn: "close" | "claim", id: number) => {
    if (!MARKET) return;
    setBusy(label);
    try {
      await send(MARKET, encodeFunctionData({ abi: marketAbi, functionName: fn, args: [BigInt(id)] }));
      done(fn === "close" ? "Lease closed and the unused part refunded." : "Earnings claimed.");
    } catch (e) { fail(e); } finally { setBusy(null); }
  };
  const top = async (id: number) => {
    const a = Number(topping[id]) || 0;
    if (!MARKET || a <= 0) return;
    setBusy("Topping up…");
    try {
      const raw = parseUnits(a.toFixed(USDG_DECIMALS), USDG_DECIMALS);
      await send(USDG as `0x${string}`, encodeFunctionData({ abi: erc20ApproveAbi, functionName: "approve", args: [MARKET, raw] }));
      await send(MARKET, encodeFunctionData({ abi: marketAbi, functionName: "topUp", args: [BigInt(id), raw] }));
      setTopping((t) => ({ ...t, [id]: "" }));
      done("Topped up — the runway just got longer.");
    } catch (e) { fail(e); } finally { setBusy(null); }
  };

  if (!wallet.address) return <div className="card empty">Connect a wallet to see your leases.</div>;
  if (leases.length === 0) return <div className="card empty">No leases yet. Rent something from the market and it shows up here.</div>;

  const live = leases.filter((l) => !l.closedAt);
  const past = leases.filter((l) => l.closedAt);
  const spent = leases.reduce((s, l) => s + l.earned, 0);
  const held = live.reduce((s, l) => s + l.refundable, 0);

  return (
    <div className="shell aside">
      <div>
        <h1 className="display sm" style={{ marginBottom: 16 }}><Typed text="Your leases" /> ({live.length})</h1>
        <div className="card">
          <div className="card-head"><span className="k">Running</span><span className="k live">metering</span></div>
          <div className="card-pad" style={{ gap: 0 }}>
          {live.length === 0 ? <div className="empty">Nothing running right now.</div> : live.map((l) => {
            const used = l.funded > 0 ? Math.min(100, (l.earned / l.funded) * 100) : 0;
            return (
              <div className="line" key={l.id} style={{ alignItems: "flex-start" }}>
                <span className="line-art k"><Icon kind={l.kind} i={l.id} /></span>
                <div className="id">
                  <b>{l.spec.split("/")[0]?.trim() || KINDS[l.kind]}</b>
                  <span>{fmt(l.pricePerHour)}/hr · {humanDuration(l.runway)} left · to {short(l.provider)}</span>
                  <div className="bar"><i style={{ width: `${used}%` }} /></div>
                  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <div className="inp" style={{ padding: "6px 11px", width: 130 }}>
                      <input type="number" min="0" placeholder="Top up" value={topping[l.id] ?? ""} onChange={(e) => setTopping((t) => ({ ...t, [l.id]: e.target.value }))} style={{ fontSize: 13 }} />
                      <span className="unit">USDG</span>
                    </div>
                    <button className="btn sm" disabled={!!busy || !(Number(topping[l.id]) > 0)} onClick={() => top(l.id)}>Add</button>
                    <button className="btn sm" disabled={!!busy} onClick={() => act("Closing…", "close", l.id)}>{busy ?? "Stop & refund"}</button>
                  </div>
                  {/^https?:\/\//.test(l.endpoint) && <Access l={l} wallet={wallet} />}
                </div>
                <div style={{ textAlign: "right" }}>
                  <b style={{ fontSize: 15, fontVariantNumeric: "tabular-nums" }}>{fmt(l.refundable)}</b>
                  <span style={{ display: "block", fontSize: 11, color: "var(--faint)" }}>refundable</span>
                </div>
              </div>
            );
          })}
          </div>
        </div>

        {past.length > 0 && (
          <>
            <h2 className="display sm" style={{ fontSize: 20, margin: "26px 0 12px" }}>Closed</h2>
            <div className="card">
              <div className="card-pad" style={{ gap: 0 }}>
              {past.map((l) => (
                <div className="line" key={l.id}>
                  <span className="line-art k"><Icon kind={l.kind} i={l.id} /></span>
                  <div className="id">
                    <b>{l.spec.split("/")[0]?.trim() || KINDS[l.kind]}</b>
                    <span>ran {humanDuration(l.closedAt - l.startAt)} · paid {fmt(l.earned)}</span>
                  </div>
                  <span className="chip off">Closed</span>
                </div>
              ))}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="card card-pad">
        <h3>Summary</h3>
        <div className="kv"><span>Running</span><b>{live.length}</b></div>
        <div className="kv"><span>Spent so far</span><b>{fmt(spent)}</b></div>
        <div className="kv"><span>Still refundable</span><b>{fmt(held)}</b></div>
        <div className="total"><span>Held in escrow</span><b>{fmt(held)}</b></div>
        <p className="kicker" style={{ fontSize: 12 }}>
          Escrow is yours until the seconds are used. Closing a lease returns the rest in the same transaction.
        </p>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------- provide

function Provide({ listings, fmt, busy, setBusy, send, done, fail, wallet }: Common & { listings: Listing[] }) {
  const [kind, setKind] = useState(0);
  const [price, setPrice] = useState("");
  const [spec, setSpec] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const mine = listings.filter((l) => wallet.address && l.provider.toLowerCase() === wallet.address.toLowerCase());

  const create = async () => {
    const p = Number(price) || 0;
    if (!MARKET || !wallet.address || p <= 0 || !spec.trim()) return;
    setBusy("Listing…");
    try {
      const raw = parseUnits(p.toFixed(USDG_DECIMALS), USDG_DECIMALS);
      await send(MARKET, encodeFunctionData({
        abi: marketAbi, functionName: "list", args: [kind, raw, spec.trim(), endpoint.trim()],
      }));
      setSpec(""); setEndpoint(""); setPrice("");
      done("Listed. It is on the shelf now.");
    } catch (e) { fail(e); } finally { setBusy(null); }
  };

  return (
    <div className="shell even">
      <div className="card">
        <div className="card-head"><span className="k">List a machine</span><span className="k">no deposit</span></div>
        <div className="card-pad">
        <p className="kicker" style={{ margin: 0, fontSize: 14 }}>
          No deposit, no approval, no queue. You are paid per second while it runs, and can
          withdraw the earned part at any point without ending the lease.
        </p>

        <div className="field">
          <span className="k">Kind</span>
          <div className="seg">
            {KINDS.map((k, i) => <button key={k} className={kind === i ? "on" : ""} onClick={() => setKind(i)}>{k}</button>)}
          </div>
        </div>
        <div className="field">
          <span className="k">Spec — separate parts with /</span>
          <div className="inp"><input placeholder="RTX 4090 / 24GB VRAM / eu-central" value={spec} onChange={(e) => setSpec(e.target.value)} /></div>
        </div>
        <div className="field">
          <span className="k">Endpoint given to the renter</span>
          <div className="inp"><input placeholder="ssh://box.example.com:22" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} style={{ fontSize: 13.5 }} /></div>
        </div>
        <div className="field">
          <span className="k">Price per hour</span>
          <div className="inp"><input type="number" min="0" step="any" placeholder="0.00" value={price} onChange={(e) => setPrice(e.target.value)} /><span className="unit">USDG</span></div>
        </div>
        <button className="btn primary wide" disabled={!MARKET || !wallet.address || !!busy || !(Number(price) > 0) || !spec.trim()} onClick={create}>
          {busy ?? (!wallet.address ? "Connect wallet" : "Publish listing")}
        </button>
        <p className="warn-note">
          The endpoint is written on-chain in the clear, where anyone can read it. Publish a
          hostname — never a key, a token or a password.
        </p>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="k">Your listings</span>
          <span className="k">{mine.length || 0} live</span>
        </div>
        <div className="card-pad" style={{ gap: 0 }}>
          {!wallet.address ? <div className="empty">Connect a wallet to see yours.</div>
            : mine.length === 0 ? <div className="empty">Nothing listed yet.</div>
            : mine.map((l) => (
              <div className="line" key={l.id}>
                <span className="line-art k"><Icon kind={l.kind} i={l.id} /></span>
                <div className="id">
                  <b>{l.spec.split("/")[0]?.trim() || KINDS[l.kind]}</b>
                  <span>{fmt(l.pricePerHour)}/hr · {KINDS[l.kind]}</span>
                </div>
                <span className={`chip ${l.open ? "on" : "off"}`}>{l.open ? "Open" : "Closed"}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
