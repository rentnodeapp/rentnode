"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { encodeFunctionData, parseUnits } from "viem";
import { useWallet } from "../wallet.ts";
import { makeFormat } from "../../src/money.ts";
import { MARKET, USDG, USDG_DECIMALS, KINDS, marketAbi, erc20ApproveAbi, humanDuration } from "../../src/market.ts";
import type { Listing, Lease } from "../api/market/route.ts";
import { Icon, Mark, Arrow } from "../icons.tsx";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
type Tab = "market" | "leases" | "provide";

export default function App() {
  const wallet = useWallet();
  const fmt = useMemo(() => makeFormat("USD", 2), []);
  const [tab, setTab] = useState<Tab>("market");
  const [data, setData] = useState<{ deployed: boolean; listings: Listing[]; leases: Lease[]; usdg: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [picked, setPicked] = useState<number | null>(null);

  const load = useCallback(async (addr: string) => {
    try {
      const r = await fetch(`/api/market${addr ? `?address=${addr}` : ""}`);
      setData(await r.json());
    } catch { /* keep the last good read */ }
  }, []);
  useEffect(() => { void load(wallet.address ?? ""); }, [wallet.address, load]);
  // leases meter per second, so the numbers have to move on their own
  useEffect(() => {
    const t = setInterval(() => void load(wallet.address ?? ""), 10_000);
    return () => clearInterval(t);
  }, [wallet.address, load]);

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

  return (
    <div>
      <nav className="nav">
        <a className="brand mini" href="/"><Mark /><span>Compute</span></a>
        <div className="nav-links tabs">
            {(["market", "leases", "provide"] as Tab[]).map((t) => (
              <button key={t} className={tab === t ? "on" : ""} onClick={() => { setTab(t); setMsg(null); setPicked(null); }}>
                {t === "market" ? "Market" : t === "leases" ? `Leases${open.length ? ` (${open.length})` : ""}` : "Provide"}
              </button>
            ))}
        </div>
        <span style={{ marginLeft: 18 }}>
          {wallet.address
            ? <button className="btn sm" onClick={() => wallet.disconnect()}>{short(wallet.address)}</button>
            : <button className="btn sm primary" onClick={() => void wallet.connect()} disabled={wallet.busy}>{wallet.busy ? "…" : "Connect"}</button>}
        </span>
      </nav>

      <main className="wrap" style={{ paddingTop: 34, paddingBottom: 90 }}>
        {msg && <div className={`msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</div>}
        {data && !data.deployed && (
          <div className="msg err">The marketplace contract isn&apos;t deployed yet — the shelf fills the moment it is.</div>
        )}

        {tab === "market" && (
          picked !== null && listings[picked]
            ? <Detail l={listings[picked]} back={() => setPicked(null)} {...common} />
            : <Market listings={listings} pick={setPicked} fmt={fmt} />
        )}
        {tab === "leases" && <Leases leases={leases} {...common} />}
        {tab === "provide" && <Provide listings={listings} {...common} />}
      </main>
    </div>
  );
}

type Common = {
  fmt: (n: number) => string; busy: string | null; setBusy: (s: string | null) => void;
  send: (to: `0x${string}`, d: `0x${string}`) => Promise<`0x${string}`>;
  done: (t: string) => void; fail: (e: unknown) => void;
  wallet: ReturnType<typeof useWallet>; usdg: number;
};

// ------------------------------------------------------------------ market

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
      <div className="card mkt-hero">
        <div style={{ minWidth: 0 }}>
          <div className="pill"><span>Metered by the second · settlement only</span></div>
          <h1 className="display" style={{ fontSize: "clamp(28px,3.6vw,40px)", margin: 0 }}>Rent the machine,<br />not the month</h1>
        </div>
        <span className="sp" />
        <Icon kind={0} size={92} />
      </div>

      <div className="shell">
        <aside className="filters card">
          <div className="grp">
            <span className="k">Search</span>
            <div className="inp" style={{ marginTop: 9, padding: "9px 13px" }}>
              <input placeholder="RTX 4090, eu-central…" value={q} onChange={(e) => setQ(e.target.value)} style={{ fontSize: 13.5 }} />
            </div>
          </div>
          <div className="grp">
            <span className="k">Category</span>
            <div className="seg">
              <button className={kind < 0 ? "on" : ""} onClick={() => setKind(-1)}>All</button>
              {KINDS.map((k, i) => <button key={k} className={kind === i ? "on" : ""} onClick={() => setKind(i)}>{k}</button>)}
            </div>
          </div>
          <div className="grp">
            <span className="k">Sort by</span>
            <div className="seg">
              {([["new", "Newest"], ["cheap", "Cheapest"], ["dear", "Priciest"]] as const).map(([v, l]) => (
                <button key={v} className={sort === v ? "on" : ""} onClick={() => setSort(v)}>{l}</button>
              ))}
            </div>
          </div>
          <div className="grp">
            <label className="switch">
              <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} />
              <i />Available only
            </label>
          </div>
        </aside>

        <section>
          <div className="count">Showing {rows.length} of {listings.length} machines</div>
          {rows.length === 0 ? (
            <div className="card empty">
              Nothing listed yet. Anyone can add a machine from the <b>Provide</b> tab — there is no gatekeeper and no deposit.
            </div>
          ) : (
            <div className="grid">
              {rows.map((l) => (
                <button className="tile" key={l.id} onClick={() => pick(l.id)}>
                  <span className={`chip ${l.open ? "on" : "off"} hot`}>{l.open ? KINDS[l.kind] : "Closed"}</span>
                  <span className="tile-art k"><Icon kind={l.kind} /></span>
                  <h4>{l.spec.split("/")[0]?.trim() || KINDS[l.kind]}</h4>
                  <p className="sub">{l.spec}</p>
                  <div className="tile-foot">
                    <span className="price">{fmt(l.pricePerHour)}<i> /hr</i></span>
                    <span className="sp" />
                    <span className="k" aria-hidden>OPEN →</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
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
            <Icon kind={l.kind} size={120} />
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
        <h1 className="display sm" style={{ marginBottom: 16 }}>Your leases ({live.length})</h1>
        <div className="card">
          <div className="card-head"><span className="k">Running</span><span className="k live">metering</span></div>
          <div className="card-pad" style={{ gap: 0 }}>
          {live.length === 0 ? <div className="empty">Nothing running right now.</div> : live.map((l) => {
            const used = l.funded > 0 ? Math.min(100, (l.earned / l.funded) * 100) : 0;
            return (
              <div className="line" key={l.id} style={{ alignItems: "flex-start" }}>
                <span className="line-art k"><Icon kind={l.kind} /></span>
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
                  <span className="line-art k"><Icon kind={l.kind} /></span>
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
                <span className="line-art k"><Icon kind={l.kind} /></span>
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
