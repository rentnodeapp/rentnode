"use client";

import { useEffect, useRef, useState } from "react";
import "./hero.css";
import { APP_URL, DOCS_URL, SITE_URL } from "../src/site.ts";

/* The full-viewport video hero. Three behaviours, each owned by one effect:
   the entrance sequence (runs once, then detaches every rule it used), the
   burger menu, and the two-video cross-fade that hides the loop seam. The
   background is the stage and is never animated; only the foreground moves. */

const LINKS: [string, string][] = [["#how", "How"], ["#shelf", "Shelf"], ["#supply", "Supply"], ["#functions", "Spec"], [DOCS_URL, "Docs"]];

const Arw = () => (
  <svg className="arw" viewBox="0 0 12 10" fill="none" aria-hidden="true">
    <path d="M0.8 5h10M7.1 1.4 10.9 5l-3.8 3.6" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function Hero() {
  const [open, setOpen] = useState(false);
  const burger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLElement>(null);
  const a = useRef<HTMLVideoElement>(null);
  const b = useRef<HTMLVideoElement>(null);

  // ---- entrance: arm synchronously, start when fonts resolve, detach when done
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const html = document.documentElement;
    html.classList.add("anim");
    let started = false, cleaned = false, safety = 0;
    const clean = () => {
      if (cleaned) return; cleaned = true;
      clearTimeout(safety); document.removeEventListener("animationend", onEnd, true);
      html.classList.remove("anim", "go");
    };
    const onEnd = (e: AnimationEvent) => {
      if (e.animationName === "pillIn" && (e.target as HTMLElement).classList.contains("hx-ghost")) clean();
    };
    const start = () => {
      if (started) return; started = true; clearTimeout(boot);
      document.addEventListener("animationend", onEnd, true);
      safety = window.setTimeout(clean, 2600);
      html.classList.add("go");
    };
    const boot = window.setTimeout(start, 900);
    (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready.then(start, start) ?? start();
    return clean;
  }, []);

  // ---- burger: outside click and Escape close it
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menu.current?.contains(t) && !burger.current?.contains(t)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); burger.current?.focus(); } };
    document.addEventListener("click", away); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("click", away); document.removeEventListener("keydown", key); };
  }, [open]);

  // ---- video: cross-fade the two copies at the loop point
  useEffect(() => {
    const A = a.current, B = b.current; if (!A || !B) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      A.removeAttribute("autoplay"); A.pause(); B.pause();
      try { A.currentTime = 0; } catch { /* first frame is the composed still */ }
      return;
    }
    const FADE = 0.9;
    let cur = A, nxt = B, swapping = false;
    const play = (v: HTMLVideoElement) => { v.play().catch(() => {}); };
    play(A);
    const tick = () => {
      if (swapping || !cur.duration) return;
      if (cur.duration - cur.currentTime > FADE) return;
      swapping = true;
      const out = cur;
      nxt.currentTime = 0; play(nxt);
      nxt.classList.add("is-active"); out.classList.remove("is-active");
      [cur, nxt] = [nxt, cur];
      setTimeout(() => { out.pause(); out.currentTime = 0; swapping = false; }, FADE * 1000 + 100);
    };
    A.addEventListener("timeupdate", tick); B.addEventListener("timeupdate", tick);
    return () => { A.removeEventListener("timeupdate", tick); B.removeEventListener("timeupdate", tick); };
  }, []);

  const vid = (id: string, active: boolean) => (
    <video ref={active ? a : b} className={`hx-vid${active ? " is-active" : ""}`} id={id} autoPlay={active} muted loop playsInline preload="auto" disablePictureInPicture aria-hidden="true" poster="/media/globe.webp">
      <source src="/media/globe.mp4" type="video/mp4" />
    </video>
  );

  return (
    <main className="hx">
      <div className="hx-bg" role="img" aria-label="Stylised globe of Earth rendered as a violet dot matrix against a starfield, slowly rotating">
        {vid("bgVideoA", true)}
        {vid("bgVideoB", false)}
      </div>

      <header className="hx-nav">
        {/* eslint-disable-next-line @next/next/no-img-element -- static 256px mark */}
        <a className="hx-logo" href={SITE_URL}><img src="/logo.png" alt="" width={24} height={24} />Rentnode</a>
        <nav className="hx-links" aria-label="Primary">
          {LINKS.map(([h, l]) => <a key={h} href={h}>{l}</a>)}
        </nav>
        <div className="hx-actions">
          <a className="hx-btn hx-login" href={APP_URL}>Console</a>
          <a className="hx-btn hx-start" href={APP_URL}>Open the market<Arw /></a>
        </div>
        <button ref={burger} className="hx-burger" id="burger" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="menu" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}><span /></button>
      </header>

      <nav ref={menu} className={`hx-menu${open ? " open" : ""}`} id="menu" aria-label="Mobile" onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setOpen(false); }}>
        {LINKS.map(([h, l]) => <a key={h} href={h}>{l}</a>)}
        <div className="divider" />
        <a href={APP_URL}>Console</a>
        <a className="m-start" href={APP_URL}>Open the market<Arw /></a>
      </nav>

      <div className="hx-inner">
        <h1><span className="ln"><span className="ln-i">Rent compute</span></span><span className="ln"><span className="ln-i">by the second</span></span></h1>
        <p className="hx-sub">
          GPUs, CPUs, disks and databases from whoever has them spare.<br />
          Escrow USDG, pay only for the seconds you use, and stop the moment<br />
          it stops being worth it — every unspent cent comes straight back.
        </p>
        <div className="hx-ctas">
          <a className="hx-btn hx-lg hx-primary" href={APP_URL}>Open the market<Arw /></a>
          <a className="hx-btn hx-lg hx-ghost" href="#functions">Read the spec<Arw /></a>
        </div>
      </div>
    </main>
  );
}
