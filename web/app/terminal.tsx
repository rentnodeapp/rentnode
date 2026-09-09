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
  "$ compute rent --listing 3 --hours 4",
  "→ escrow  14.400000 USDG  accepted",
  "→ rate    0.001000 USDG/sec",
  "→ host    ssh://box.eu-central-1:22",
  "→ metering started at block 4663",
];

const pad = (n: number) => String(Math.floor(n)).padStart(2, "0");
const clock = (s: number) => `${pad(s / 3600)}:${pad((s % 3600) / 60)}:${pad(s % 60)}`;

export function HeroTerminal() {
  const [lines, setLines] = useState(0);
  const [secs, setSecs] = useState(0);
  const [cells, setCells] = useState<number[]>(() => Array(96).fill(0));
  const still = useRef(false);

  useEffect(() => {
    still.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (still.current) { setLines(BOOT.length); setSecs(4200); return; }

    let n = 0;
    const id = setInterval(() => {
      n++;
      // the command types itself out first, then the meter takes over
      if (n <= BOOT.length * 4) { setLines(Math.ceil(n / 4)); return; }
      setSecs((s) => (s + SPEED >= FUNDED / RATE ? 0 : s + SPEED));
      setCells((c) => c.map((v) => (Math.random() < 0.14 ? (v ? 0 : 1) : v)));
    }, TICK);
    return () => clearInterval(id);
  }, []);

  // reset the transcript whenever the meter wraps, so the loop reads as a new lease
  useEffect(() => { if (secs === 0 && !still.current) setLines(0); }, [secs]);

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

        {/* 96 cores, lighting at random - the only decorative part of the panel */}
        <div className="term-grid" aria-hidden>
          {cells.map((v, i) => <i key={i} className={v ? "on" : ""} />)}
        </div>
      </div>
    </div>
  );
}
