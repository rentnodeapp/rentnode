"use client";

import { useEffect, useRef, useState } from "react";
import "@xterm/xterm/css/xterm.css";

/* A shell on a leased machine, in the console. The browser signs the same
   short message the access endpoint uses, opens a websocket to the relay, and
   xterm renders whatever ssh sends back. Keystrokes go up as text frames; a
   resize goes up as "\x01cols rows". */

type Wallet = { sign: (msg: string) => Promise<string> };

export function Terminal({ leaseId, endpoint, wallet }: { leaseId: number; endpoint: string; wallet: Wallet }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string>("");
  const box = useRef<HTMLDivElement>(null);
  const sock = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!open || !box.current) return;
    let term: import("@xterm/xterm").Terminal | null = null;
    let dead = false;
    (async () => {
      setStatus("signing…");
      const [{ Terminal: XTerm }, { FitAddon }] = await Promise.all([import("@xterm/xterm"), import("@xterm/addon-fit")]);
      if (dead || !box.current) return;
      term = new XTerm({ cursorBlink: true, fontSize: 13, fontFamily: "var(--font-mono), JetBrains Mono, monospace", theme: { background: "#02120a", foreground: "#eef7e0", cursor: "#c9f27a", selectionBackground: "rgba(201,242,122,.25)" } });
      const fit = new FitAddon(); term.loadAddon(fit); term.open(box.current); fit.fit();
      let sig: string;
      const msg = `rentnode lease ${leaseId} ${Math.floor(Date.now() / 60000)}`;
      try { sig = await wallet.sign(msg); } catch { setStatus("signature refused"); return; }
      if (dead) return;
      const base = endpoint.replace(/\/lease\/?$/, "").replace(/^http/, "ws");
      const ws = new WebSocket(`${base}/term/${leaseId}?msg=${encodeURIComponent(msg)}&sig=${sig}`);
      sock.current = ws;
      ws.binaryType = "arraybuffer";
      setStatus("connecting…");
      ws.onopen = () => { setStatus("connected"); ws.send(`\x01${term!.cols} ${term!.rows}`); term!.focus(); };
      ws.onmessage = (e) => term!.write(typeof e.data === "string" ? e.data : new Uint8Array(e.data));
      ws.onclose = (e) => setStatus(e.code === 1000 ? "closed" : `closed (${e.reason || e.code})`);
      ws.onerror = () => setStatus("connection failed — is the lease ready?");
      term.onData((d) => { if (ws.readyState === ws.OPEN) ws.send(d); });
      const onResize = () => { fit.fit(); if (ws.readyState === ws.OPEN) ws.send(`\x01${term!.cols} ${term!.rows}`); };
      window.addEventListener("resize", onResize);
      ws.addEventListener("close", () => window.removeEventListener("resize", onResize));
    })();
    return () => { dead = true; sock.current?.close(); term?.dispose(); };
  }, [open, leaseId, endpoint, wallet]);

  return (
    <div className="term-wrap">
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button className="btn sm" onClick={() => setOpen((v) => !v)}>{open ? "Close terminal" : "Open terminal"}</button>
        {open && status && <span className="k">{status}</span>}
      </div>
      {open && <div ref={box} className="term-box" />}
    </div>
  );
}

/* Live stats of the machine behind a relay listing, read from the relay's
   probe endpoint. No signature, no cost: a way to look before renting. */
export function Probe({ listingId, endpoint }: { listingId: number; endpoint: string }) {
  const [d, setD] = useState<Record<string, string | number | boolean> | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    const base = endpoint.replace(/\/lease\/?$/, "");
    fetch(`${base}/probe/${listingId}`).then((r) => r.json()).then(setD).catch((e) => setErr(e.message));
  }, [listingId, endpoint]);
  if (err) return <div className="card card-pad"><span className="k" style={{ color: "var(--rose)" }}>probe failed: {err}</span></div>;
  if (!d) return <div className="card card-pad"><span className="k">probing the machine…</span></div>;
  if (!d.available) return <div className="card card-pad"><span className="k" style={{ color: "var(--amber)" }}>no machine of this type on Vast right now</span></div>;
  const rows: [string, string][] = [
    ["GPU", `${d.gpu} · ${d.vram_gb} GB`], ["CPU", `${d.cpu} · ${d.cores} cores`], ["RAM / disk", `${d.ram_gb} GB / ${d.disk_gb} GB`],
    ["Network", `${d.down_mbps}↓ ${d.up_mbps}↑ Mbps`], ["Reliability", `${d.reliability}%`], ["DLPerf", String(d.dlperf)],
    ["CUDA / driver", `${d.cuda} / ${d.driver}`], ["Region", String(d.region)], ["Verified", d.verified ? "yes" : "no"],
  ];
  return (
    <div className="card">
      <div className="card-head"><span className="k">Live probe · read from the host</span><span className="k live">{new Date(String(d.checked_at)).toLocaleTimeString()}</span></div>
      <div className="probe">{rows.map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}</div>
    </div>
  );
}
