"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The hero instrument: a lease running in front of you.
 *
 * It is a demonstration, not a live feed - and it says so on the panel, because
 * a fake ticker dressed as real data is how people get misled. What it shows is
 * the real arithmetic though: the same rate, the same per-second accrual and the
 * same runway the contract computes, just wound forward fast enough to watch.
 */

const RATE = 0.001; // USDG per second - 3.60/hr, the figure quoted below
const FUNDED = 14.4; // four hours escrowed
const SPEED = 46; // lease-seconds per tick, so the meter is visible
const TICK = 90; // ms

const BOOT = [
  "$ rentnode rent --listing 3 --hours 4",
  "→ escrow  14.400000 USDG  accepted",
  "→ rate    0.001000 USDG/sec",
  "→ host    ssh://box.eu-central-1:22  [RTX 4090 · 24GB · CUDA 12.4]",
  "→ metering started at block 4663",
];

const pad = (n: number) => String(Math.floor(n)).padStart(2, "0");
const clock = (s: number) => `${pad(s / 3600)}:${pad((s % 3600) / 60)}:${pad(s % 60)}`;

/** true once mounted, and false forever if the reader asked for less motion. */
function useTicker(ms: number): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setN(140); return; }
    const id = setInterval(() => setN((v) => v + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
  return n;
}

/* One tick counter drives everything; the transcript, the meter and the die
   are all pure functions of it, so nothing can fall out of step. A cycle is
   the typing phase followed by one full lease, then it starts over. */
const TYPE_TICKS = BOOT.length * 2;
const LEASE_TICKS = Math.ceil(FUNDED / RATE / SPEED);
const CYCLE = TYPE_TICKS + LEASE_TICKS;

export function HeroTerminal() {
  const [n, setN] = useState(0);
  const [cells, setCells] = useState<number[]>(() => Array(128).fill(0));
  const still = useRef(false);

  useEffect(() => {
    still.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (still.current) { setN(TYPE_TICKS + 90); return; }
    const id = setInterval(() => {
      setN((v) => v + 1);
      setCells((c) => c.map((v) => (Math.random() < 0.14 ? (v ? 0 : 1) : v)));
    }, TICK);
    return () => clearInterval(id);
  }, []);

  const k = n % CYCLE;
  const lines = Math.min(BOOT.length, Math.ceil(k / 2));
  const secs = k > TYPE_TICKS ? (k - TYPE_TICKS) * SPEED : 0;

  const spent = Math.min(FUNDED, secs * RATE);
  const left = Math.max(0, FUNDED - spent);
  const used = (spent / FUNDED) * 100;

  return (
    <div className="term">
      <div className="card-head">
        <span className="k">Lease #0001 · demonstration</span>
        <span className="k live">metering</span>
      </div>

      <div className="term-body">
        <div className="term-log">
          {BOOT.slice(0, lines).map((l) => <div key={l}>{l}</div>)}
          {lines >= BOOT.length && <div className="term-cur">_</div>}
        </div>

        <div className="term-read">
          <div><span>Elapsed</span><b>{clock(secs)}</b></div>
          <div><span>Spent</span><b>{spent.toFixed(6)}</b></div>
          <div><span>Refundable</span><b>{left.toFixed(6)}</b></div>
          <div><span>Runway</span><b>{clock(left / RATE)}</b></div>
        </div>

        <div className="term-bar"><i style={{ width: `${used}%` }} /></div>
        <div className="term-note">
          <span>{used.toFixed(1)}% of escrow consumed</span>
          <span>stop now → {left.toFixed(6)} USDG returned</span>
        </div>

        {/* telemetry the way a real card reports it - illustrative values,
            but the shape is nvidia-smi's, not a marketing dashboard's */}
        <Telemetry n={secs} />

        {/* the die: 128 streaming multiprocessors, lighting by load */}
        <div className="term-die" aria-hidden>
          <div className="term-die-h"><span>SM ARRAY · 128</span><span>{Math.round(cells.filter(Boolean).length / cells.length * 100)}% ACTIVE</span></div>
          <div className="term-grid">
            {cells.map((v, i) => <i key={i} className={v ? "on" : ""} style={{ opacity: v ? 0.55 + ((i * 7) % 5) * 0.09 : 1 }} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

/** GPU telemetry rows: bar, value, unit. Jitter is deterministic from the
 *  tick so the panel is lively without being random on every render. */
function Telemetry({ n }: { n: number }) {
  const j = (k: number, amp: number) => Math.sin(n / 37 + k) * amp;
  const rows: [string, number, number, string][] = [
    ["GPU UTIL", 71 + j(1, 18), 100, "%"],
    ["VRAM", 17.2 + j(2, 1.4), 24, "GB"],
    ["SM CLOCK", 2415 + j(3, 60), 2520, "MHz"],
    ["TEMP", 63 + j(4, 4), 90, "°C"],
    ["POWER", 318 + j(5, 40), 450, "W"],
  ];
  return (
    <div className="term-tele">
      {rows.map(([k, v, max, u]) => (
        <div key={k}>
          <span>{k}</span>
          <i><b style={{ width: `${Math.min(100, (v / max) * 100)}%` }} /></i>
          <em>{u === "GB" ? v.toFixed(1) : Math.round(v)}<small>{u}</small></em>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- supply

   A provider's shelf, earning. Four machines accrue at their own rate; every
   so often one is claimed and its earned column drops back to zero, which is
   exactly what claim() does - it withdraws without ending the lease. */

const SHELF: [string, string, number][] = [
  ["RTX 4090", "24GB / eu-central", 0.00100],
  ["EPYC 9354", "32C / us-east", 0.00042],
  ["NVMe pool", "8TB / ap-south", 0.00013],
  ["Postgres 16", "4vCPU / eu-west", 0.00027],
];

export function SupplyPanel() {
  const n = useTicker(110);
  return (
    <div className="term">
      <div className="card-head">
        <span className="k">Provider ledger · demonstration</span>
        <span className="k live">accruing</span>
      </div>
      <div className="term-body">
        {SHELF.map(([name, spec, rate], i) => {
          // each row claims on its own cycle, so the panel is never in lockstep
          const cycle = 190 + i * 47;
          const held = (n % cycle) * 46 * rate;
          const justClaimed = n % cycle < 6;
          return (
            <div className={`led${justClaimed ? " flash" : ""}`} key={name}>
              <div className="led-id">
                <b>{name}</b>
                <span>{spec}</span>
              </div>
              <div className="led-rate">{rate.toFixed(5)}<i>/sec</i></div>
              <div className="led-earn">{justClaimed ? "claimed →" : held.toFixed(6)}</div>
            </div>
          );
        })}
        <div className="term-note">
          <span>earnings withdraw without ending a lease</span>
          <span>no deposit · no vetting</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ settlement

   The invariant the fuzz test proves, drawn: escrow splits into earned and
   refundable, the split point walks forward with the clock, and the two halves
   always add back to the whole. Nothing is ever stranded in the contract. */

export function SettlementPanel() {
  const n = useTicker(100);
  const pos = (n % 150) / 150; // 0 → 1, then a new lease
  const earned = 14.4 * pos;
  const refund = 14.4 - earned;
  return (
    <div className="term">
      <div className="card-head">
        <span className="k">Settlement · always sums to the escrow</span>
        <span className="k live">14.400000 USDG</span>
      </div>
      <div className="term-body">
        <div className="set-bar">
          <i className="set-earn" style={{ width: `${pos * 100}%` }} />
          <i className="set-mark" style={{ left: `${pos * 100}%` }} />
        </div>
        <div className="set-legend">
          <div><span>Earned → provider</span><b>{earned.toFixed(6)}</b></div>
          <div className="r"><span>Refunded → renter</span><b>{refund.toFixed(6)}</b></div>
        </div>
        <div className="set-sum">
          <span>{earned.toFixed(6)}</span>
          <span className="op">+</span>
          <span>{refund.toFixed(6)}</span>
          <span className="op">=</span>
          <b>14.400000</b>
        </div>
        <div className="term-note">
          <span>close() pays both sides in one transaction</span>
          <span>contract balance after: 0.000000</span>
        </div>
      </div>
    </div>
  );
}
