"use client";

// Rentnode technical docs. Full-bleed, its own chrome, the hero's green and
// lime. Prose plus hand-drawn SVG diagrams of the rail, the lease clock, the
// access hand-over and the custody model. Every figure is a constant in the
// contract or the relay, not copy.

import { useEffect, useState } from "react";
import { APP_URL, SITE_URL, GITHUB_URL } from "../../src/site.ts";
import "./docs.css";

const MARKET = "0xd172e6Aa54e2D04F4168a339B63F284c99162D9d";
const USDG = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";
const RELAY = "0xb3180B4a2B6dB9415FA26Ebe92e4aaD973e73144";
const EXPLORER = "https://robinhoodchain.blockscout.com/address";

const TOC: { group: string; items: { id: string; label: string }[] }[] = [
  { group: "Start", items: [
    { id: "overview", label: "Overview" },
    { id: "vision", label: "Vision & mission" },
    { id: "architecture", label: "Architecture" },
  ] },
  { group: "Mechanism", items: [
    { id: "listing", label: "Listing" },
    { id: "lease", label: "Escrow & metering" },
    { id: "closing", label: "Closing & settlement" },
    { id: "supply", label: "Real supply (relay)" },
  ] },
  { group: "Trust", items: [
    { id: "custody", label: "Custody model" },
    { id: "cryptography", label: "Cryptography" },
    { id: "risks", label: "Risks & limits" },
  ] },
  { group: "Protocol", items: [
    { id: "reference", label: "Reference" },
  ] },
];

const FUNCTIONS: [string, string, string][] = [
  ["list(kind, pricePerHour, spec, endpoint)", "anyone", "Publish a machine. Price in USDG per hour, 6 decimals. No deposit, no approval."],
  ["updateListing(id, pricePerHour, endpoint, open)", "provider", "Reprice, move, or close a listing. Binds future leases only."],
  ["rent(listingId, amount)", "anyone", "Escrow `amount` USDG against an open listing. The clock starts in the same block."],
  ["topUp(leaseId, amount)", "anyone", "Add funds to a running lease. Anyone may pay; only the renter is refunded."],
  ["claim(leaseId)", "provider", "Withdraw what has accrued so far, without ending the lease."],
  ["close(leaseId)", "renter or provider", "End the lease. Earned to the provider, the rest to the renter, one transaction."],
  ["earned / refundable / runway(leaseId)", "view", "Accrued so far, refund if closed now, seconds left at the current rate."],
];

const ERRORS: [string, string][] = [
  ["NotProvider", "Caller does not own the listing or lease being claimed"],
  ["NotParty", "close() from an address that is neither renter nor provider"],
  ["ListingClosed", "rent() against a listing whose open flag is false"],
  ["BadPrice", "pricePerHour of zero"],
  ["BadAmount", "Zero escrow, zero top-up, or nothing to claim"],
  ["AlreadyClosed", "topUp() or close() on a settled lease"],
  ["NoListing / NoLease", "Index past the end of the array"],
];

/* ---------------- diagrams ---------------- */

function ArchDiagram() {
  return (
    <div className="diagram">
      <svg viewBox="0 0 720 340" role="img" aria-label="Where the money and the machine live">
        <rect className="dg-box accent" x="40" y="24" width="180" height="52" rx="12" />
        <text className="dg-t" x="130" y="46" fontSize="13" textAnchor="middle">Renter</text>
        <text className="dg-t dim" x="130" y="63" fontSize="10.5" textAnchor="middle">escrows USDG, holds the only refund key</text>

        <rect className="dg-box accent" x="500" y="24" width="180" height="52" rx="12" />
        <text className="dg-t" x="590" y="46" fontSize="13" textAnchor="middle">Provider</text>
        <text className="dg-t dim" x="590" y="63" fontSize="10.5" textAnchor="middle">lists, keeps the endpoint current</text>

        <rect className="dg-box deep" x="230" y="128" width="260" height="64" rx="14" />
        <text className="dg-t on" x="360" y="153" fontSize="14" textAnchor="middle">ComputeMarket</text>
        <text className="dg-t on" x="360" y="172" fontSize="10.5" textAnchor="middle" opacity=".75">escrow · per-second meter · settle</text>

        <rect className="dg-box" x="40" y="250" width="180" height="56" rx="12" />
        <text className="dg-t" x="130" y="273" fontSize="13" textAnchor="middle">USDG</text>
        <text className="dg-t dim" x="130" y="290" fontSize="10.5" textAnchor="middle">the only token it touches</text>

        <rect className="dg-box" x="500" y="250" width="180" height="56" rx="12" />
        <text className="dg-t" x="590" y="273" fontSize="13" textAnchor="middle">The machine</text>
        <text className="dg-t dim" x="590" y="290" fontSize="10.5" textAnchor="middle">off-chain · never seen by the contract</text>

        <g strokeWidth="1.4">
          <path className="dg-line lav" d="M170 76 L300 126" markerEnd="url(#a1)" />
          <path className="dg-line lav" d="M550 76 L420 126" markerEnd="url(#a1)" />
          <path className="dg-line" d="M300 192 L170 248" markerEnd="url(#a0)" />
          <path className="dg-line dash" d="M590 248 L590 78" markerEnd="url(#a0)" />
        </g>
        <text className="dg-t dim" x="628" y="170" fontSize="10">ssh, http, whatever</text>
        <text className="dg-t dim" x="628" y="184" fontSize="10">the listing says</text>
        <defs>
          <marker id="a0" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0L6 3.5L0 7z" fill="#7fa58a" /></marker>
          <marker id="a1" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0L6 3.5L0 7z" fill="#c9f27a" /></marker>
        </defs>
      </svg>
      <p className="dg-cap">One contract, one token, no owner. The machine is on the right and the chain never looks at it - that is the design, not a gap.</p>
    </div>
  );
}

function LeaseDiagram() {
  return (
    <div className="diagram">
      <svg viewBox="0 0 720 230" role="img" aria-label="A lease over time">
        <text className="dg-t dim" x="40" y="30" fontSize="11">FUNDED ESCROW, SECOND BY SECOND</text>
        <rect className="dg-box" x="40" y="46" width="640" height="38" rx="10" />
        <rect x="41" y="47" width="352" height="36" rx="9" fill="#c9f27a" />
        <rect x="393" y="47" width="286" height="36" rx="9" fill="rgba(201,242,122,.10)" />
        <text className="dg-t on" x="216" y="70" fontSize="12" textAnchor="middle" fontWeight="600">earned · to the provider</text>
        <text className="dg-t lav" x="536" y="70" fontSize="12" textAnchor="middle">refundable · to the renter</text>

        <line x1="41" y1="40" x2="41" y2="120" className="dg-line lav" strokeWidth="1.5" />
        <text className="dg-t mono" x="41" y="136" fontSize="11" textAnchor="start">startAt</text>
        <line x1="393" y1="40" x2="393" y2="120" className="dg-line lav" strokeWidth="1.5" />
        <text className="dg-t mono" x="393" y="136" fontSize="11" textAnchor="middle">now · close()</text>
        <line x1="679" y1="40" x2="679" y2="120" className="dg-line" strokeWidth="1.5" strokeDasharray="4 4" />
        <text className="dg-t mono" x="679" y="136" fontSize="11" textAnchor="end">runway = 0</text>

        <text className="dg-t dim" x="40" y="180" fontSize="11">earned = pricePerHour × elapsed ÷ 3600, capped at funded. A lease never goes into debt.</text>
        <text className="dg-t dim" x="40" y="200" fontSize="11">Price is frozen at rent(). A provider repricing the listing cannot touch a live lease.</text>
        <text className="dg-t dim" x="40" y="220" fontSize="11">claim() moves the lime part any time; close() moves both parts at once and stops the clock.</text>
      </svg>
      <p className="dg-cap">Two numbers describe every lease: what has been earned, and what is left. Both are one read on the contract.</p>
    </div>
  );
}

function AccessDiagram() {
  return (
    <div className="diagram">
      <svg viewBox="0 0 720 220" role="img" aria-label="How access is handed over">
        <rect className="dg-box accent" x="30" y="60" width="170" height="60" rx="12" />
        <text className="dg-t" x="115" y="84" fontSize="13" textAnchor="middle">Renter&apos;s wallet</text>
        <text className="dg-t dim" x="115" y="102" fontSize="10.5" textAnchor="middle">signs one message, no gas</text>

        <rect className="dg-box" x="275" y="60" width="170" height="60" rx="12" />
        <text className="dg-t" x="360" y="84" fontSize="13" textAnchor="middle">Relay</text>
        <text className="dg-t dim" x="360" y="102" fontSize="10.5" textAnchor="middle">recovers signer · reads lease.renter</text>

        <rect className="dg-box deep" x="520" y="60" width="170" height="60" rx="12" />
        <text className="dg-t on" x="605" y="84" fontSize="13" textAnchor="middle" fontWeight="600">ssh access</text>
        <text className="dg-t on" x="605" y="102" fontSize="10.5" textAnchor="middle" opacity=".75">host · port · per-lease key</text>

        <g strokeWidth="1.4">
          <path className="dg-line lav" d="M200 90 L273 90" markerEnd="url(#a2)" />
          <path className="dg-line lav" d="M445 90 L518 90" markerEnd="url(#a2)" />
          <path className="dg-line dash" d="M360 120 L360 160" markerEnd="url(#a3)" />
        </g>
        <text className="dg-t mono" x="236" y="48" fontSize="10" textAnchor="middle">rentnode lease &lt;id&gt; &lt;minute&gt;</text>
        <text className="dg-t dim" x="360" y="180" fontSize="10.5" textAnchor="middle">ComputeMarket.leaseAt(id).renter must equal the recovered address</text>
        <text className="dg-t dim" x="360" y="196" fontSize="10.5" textAnchor="middle">signature older than 5 minutes is refused</text>
        <defs>
          <marker id="a2" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0L6 3.5L0 7z" fill="#c9f27a" /></marker>
          <marker id="a3" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0L6 3.5L0 7z" fill="#7fa58a" /></marker>
        </defs>
      </svg>
      <p className="dg-cap">The contract stores one endpoint per listing, but a lease is per renter. The signature is what turns a public URL into a private door.</p>
    </div>
  );
}

function CustodyDiagram() {
  return (
    <div className="diagram">
      <svg viewBox="0 0 720 200" role="img" aria-label="Who can move what">
        <rect className="dg-box accent" x="30" y="30" width="200" height="140" rx="14" />
        <text className="dg-t" x="130" y="58" fontSize="13" textAnchor="middle">Renter can</text>
        <text className="dg-t dim" x="130" y="82" fontSize="11" textAnchor="middle">rent · top up</text>
        <text className="dg-t dim" x="130" y="100" fontSize="11" textAnchor="middle">close, any second</text>
        <text className="dg-t dim" x="130" y="118" fontSize="11" textAnchor="middle">take every unspent cent</text>
        <text className="dg-t dim" x="130" y="136" fontSize="11" textAnchor="middle">fetch access with a signature</text>

        <rect className="dg-box accent" x="260" y="30" width="200" height="140" rx="14" />
        <text className="dg-t" x="360" y="58" fontSize="13" textAnchor="middle">Provider can</text>
        <text className="dg-t dim" x="360" y="82" fontSize="11" textAnchor="middle">list · reprice · close listing</text>
        <text className="dg-t dim" x="360" y="100" fontSize="11" textAnchor="middle">claim what has accrued</text>
        <text className="dg-t dim" x="360" y="118" fontSize="11" textAnchor="middle">close a lease, keeping only earned</text>
        <text className="dg-t dim" x="360" y="136" fontSize="11" textAnchor="middle">never raise a live rate</text>

        <rect className="dg-box warn" x="490" y="30" width="200" height="140" rx="14" />
        <text className="dg-t warn" x="590" y="58" fontSize="13" textAnchor="middle">Rentnode can</text>
        <text className="dg-t dim" x="590" y="90" fontSize="11" textAnchor="middle">— nothing —</text>
        <text className="dg-t dim" x="590" y="112" fontSize="10.5" textAnchor="middle">no owner · no pause</text>
        <text className="dg-t dim" x="590" y="128" fontSize="10.5" textAnchor="middle">no fee switch · no upgrade</text>
        <text className="dg-t dim" x="590" y="144" fontSize="10.5" textAnchor="middle">no way to freeze escrow</text>
      </svg>
      <p className="dg-cap">The third column is the product. The relay is a provider like any other; its key has no more power than yours.</p>
    </div>
  );
}

/* ---------------- page ---------------- */

function useScrollSpy() {
  const [active, setActive] = useState("overview");
  useEffect(() => {
    const root = document.querySelector(".docs") as HTMLElement | null;
    const secs = Array.from(document.querySelectorAll<HTMLElement>(".docs-sec"));
    if (!secs.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { root, rootMargin: "-72px 0px -70% 0px", threshold: 0 },
    );
    secs.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);
  return active;
}

export default function Docs() {
  const active = useScrollSpy();
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    if (!menu) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(false); };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [menu]);

  const Toc = ({ close }: { close?: () => void }) => (
    <>
      {TOC.map((g) => (
        <div key={g.group}>
          <div className="toc-group">{g.group}</div>
          {g.items.map((it) => (
            <a key={it.id} href={`#${it.id}`} className={active === it.id ? "on" : ""} onClick={close}>{it.label}</a>
          ))}
        </div>
      ))}
    </>
  );

  return (
    <div className="docs">
      <nav className="docs-nav">
        <a href={SITE_URL} className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" width={24} height={24} />
          Rentnode <small>DOCS</small>
        </a>
        <span style={{ flex: 1 }} />
        <a href={SITE_URL} className="dn-link">Home</a>
        <a href={`${EXPLORER}/${MARKET}?tab=contract`} className="dn-link" target="_blank" rel="noreferrer">Contract</a>
        <a href={GITHUB_URL} className="dn-link" target="_blank" rel="noreferrer">GitHub</a>
        <a href={APP_URL} className="dn-cta">Open the market ↗</a>
        <button className={`docs-burger${menu ? " open" : ""}`} onClick={() => setMenu((v) => !v)} aria-label={menu ? "Close contents" : "Open contents"} aria-expanded={menu}>
          <i /><i /><i />
        </button>
      </nav>

      {menu && (
        <>
          <button className="docs-veil" onClick={() => setMenu(false)} aria-label="Close contents" />
          <div className="docs-drawer">
            <Toc close={() => setMenu(false)} />
            <div className="docs-drawer-foot">
              <a href={SITE_URL} onClick={() => setMenu(false)}>Home</a>
              <a href={`${EXPLORER}/${MARKET}`} target="_blank" rel="noreferrer">Contract</a>
              <a href={GITHUB_URL} target="_blank" rel="noreferrer">GitHub</a>
              <a href={APP_URL}>Console</a>
            </div>
          </div>
        </>
      )}

      <div className="docs-shell">
        <aside className="docs-side">
          <nav className="docs-toc"><Toc /></nav>
        </aside>

        <main className="docs-main">
          <header className="docs-hero">
            <span className="eyebrow">Protocol documentation</span>
            <h1>How <b>Rentnode</b> works</h1>
            <p className="lead">
              Rentnode is a marketplace for rented infrastructure - GPUs, CPUs, disks and databases -
              reduced to the one thing a chain can actually do: hold money and meter it out per
              second. One contract on Robinhood Chain, no owner, no fee, no arbiter. This is the
              technical reference for what it does and, just as importantly, what it cannot.
            </p>
            <div className="docs-chips">
              <span className="docs-chip">Chain <b>Robinhood (EVM 4663)</b></span>
              <span className="docs-chip">Unit <b>USDG · 6 decimals</b></span>
              <span className="docs-chip">Granularity <b>1 second</b></span>
              <span className="docs-chip">Admin <b>none</b></span>
            </div>
          </header>

          <section id="overview" className="docs-sec">
            <span className="kicker">Overview</span>
            <h2>A meter, <b>not a middleman</b></h2>
            <p>
              Renting a machine from a stranger normally needs someone in the middle: to hold the
              deposit, to decide who was right when the box went down, to take a cut for the
              trouble. Rentnode removes that seat. A renter escrows USDG against a listing, the
              contract pays it out to the provider one second at a time, and either side can stop
              the clock whenever they like. Every unspent cent goes back to the renter in the same
              transaction.
            </p>
            <ul>
              <li><strong>List</strong> - a provider publishes a machine and an hourly price. No deposit, no application, no approval queue.</li>
              <li><strong>Escrow</strong> - a renter funds however many hours they want. The USDG sits in the contract; nobody can move it but the metering.</li>
              <li><strong>Meter</strong> - payment accrues to the provider per second. They may withdraw the earned part at any moment.</li>
              <li><strong>Stop</strong> - either side closes. Earned to the provider, the remainder to the renter, one transaction.</li>
            </ul>
            <div className="docs-note">
              <span className="n-ico">◆</span>
              <p>The contract does not run, verify or vouch for any machine. A listing is a claim its provider makes. Your protection is not a judge - it is that leaving costs you nothing but the seconds you used.</p>
            </div>
          </section>

          <section id="vision" className="docs-sec">
            <span className="kicker">Vision &amp; mission</span>
            <h2>Compute priced <b>like electricity</b></h2>
            <h3>Vision</h3>
            <p>
              Idle hardware is everywhere: a gaming rig at night, a lab&apos;s cluster between
              papers, a startup&apos;s over-provisioned box. What stops it being rented is not the
              hardware, it is the paperwork - accounts, minimums, invoices, disputes. Rentnode&apos;s
              vision is a market where anyone can plug a machine in, anyone can draw from it, and
              the bill is settled by the clock rather than by a company.
            </p>
            <h3>Mission</h3>
            <ul>
              <li><strong>Per-second, no minimum.</strong> A lease can be five seconds long. The contract meters from the hourly price; it never rounds you up to an hour.</li>
              <li><strong>Exit is free.</strong> Closing a lease costs one transaction and returns everything unspent. That right belongs to the renter and cannot be revoked.</li>
              <li><strong>No arbiter by construction.</strong> The worst outcome for a renter is the seconds between a machine dying and them noticing. That is small enough that nobody needs to judge it.</li>
              <li><strong>Honest supply.</strong> Machines on the shelf are real or they are not there. The relay that mirrors Vast.ai says so in every listing&apos;s spec.</li>
              <li><strong>Immutable.</strong> No owner, no pause, no fee, no upgrade path. What deployed is what runs.</li>
            </ul>
          </section>

          <section id="architecture" className="docs-sec">
            <span className="kicker">Architecture</span>
            <h2>One contract, <b>one token</b></h2>
            <p>
              <span className="mono">ComputeMarket</span> holds two arrays - listings and leases -
              and one token reference, USDG. It talks to nothing else: no oracle, no router, no
              registry, no proxy. The console is a window onto that state; anyone can read or
              write it directly with a wallet, and a relay can act as a provider without any
              special role.
            </p>
            <ArchDiagram />
          </section>

          <section id="listing" className="docs-sec">
            <span className="kicker">Mechanism</span>
            <h2>Listing a <b>machine</b></h2>
            <p>
              <span className="mono">list(kind, pricePerHour, spec, endpoint)</span> pushes a
              listing owned by <span className="mono">msg.sender</span>. <span className="mono">kind</span>
              is one of GPU, CPU, Storage, Database and only sorts the shelf; <span className="mono">spec</span>
              is free text like <span className="mono">RTX 4090 / 24GB / eu-central</span>;
              <span className="mono"> endpoint</span> is where a renter reaches the machine once paid.
            </p>
            <ul>
              <li><strong>No deposit.</strong> A deposit only gates entry unless someone can judge when to seize it, and there is no someone. Reputation is the public lease history instead.</li>
              <li><strong>Reprice any time</strong> with <span className="mono">updateListing</span>. New leases take the new rate; a running lease keeps the rate it started at.</li>
              <li><strong>Endpoint is public.</strong> It is stored in the clear. Publish a hostname or a relay URL, never a key, a token or a password.</li>
            </ul>
            <div className="docs-formula">
              <span className="cm">// a listing, as stored</span><br />
              struct Listing {"{"} address provider; Kind kind; uint96 pricePerHour; bool open; string spec; string endpoint; {"}"}<br />
              <span className="cm">// pricePerHour is USDG with 6 decimals: 0.50 USDG/hr = 500000</span>
            </div>
          </section>

          <section id="lease" className="docs-sec">
            <span className="kicker">Mechanism</span>
            <h2>Escrow and the <b>second-hand</b></h2>
            <p>
              <span className="mono">rent(listingId, amount)</span> pulls <span className="mono">amount</span> USDG
              into the contract and opens a lease with <span className="mono">startAt = block.timestamp</span>
              and the listing&apos;s price frozen into it. From that block on, the provider&apos;s
              earnings are a pure function of time:
            </p>
            <div className="docs-formula">
              <span className="cm">// what the provider has earned so far</span><br />
              earned = min(<span className="gr">pricePerHour × (now − startAt) ÷ 3600</span>, funded)<br />
              <span className="cm">// multiply before dividing, so sub-cent seconds never round to zero</span>
            </div>
            <LeaseDiagram />
            <h3>Top-ups</h3>
            <p>
              <span className="mono">topUp(leaseId, amount)</span> adds funding to a running lease.
              Anyone may pay - a team can keep a colleague&apos;s box alive - but the refund always
              goes to the renter of record. A lease that runs out of funding simply stops earning;
              it never goes into debt, and the renter is never billed past what they escrowed.
            </p>
            <h3>Claiming</h3>
            <p>
              <span className="mono">claim(leaseId)</span> lets the provider draw down
              <span className="mono"> earned − claimed</span> at any moment without ending the lease.
              Nothing forces them to wait; nothing lets them take more than the clock has counted.
            </p>
          </section>

          <section id="closing" className="docs-sec">
            <span className="kicker">Mechanism</span>
            <h2>Closing, <b>by either side</b></h2>
            <p>
              <span className="mono">close(leaseId)</span> may be called by the renter or the
              provider - nobody else. It stamps <span className="mono">closedAt</span>, computes
              the final split, and moves both halves in one transaction. Settlement is identical
              whoever called it:
            </p>
            <div className="docs-formula">
              <span className="cm">// at close()</span><br />
              owed   = earned − claimed          <span className="cm">→ provider</span><br />
              refund = funded − claimed − owed   <span className="cm">→ renter</span><br />
              <span className="cm">// contract balance for this lease after: 0</span>
            </div>
            <ul>
              <li><strong>Renter closes</strong> because the box stopped working, or because the job finished early. Every unspent cent returns immediately.</li>
              <li><strong>Provider closes</strong> to take the machine back. They keep only what the clock counted; they cannot keep the remainder.</li>
              <li><strong>Nobody closes</strong> and the funding runs out - the lease idles at <span className="mono">runway = 0</span>, earning nothing more, until someone settles it.</li>
            </ul>
            <div className="docs-note">
              <span className="n-ico">◆</span>
              <p>This is the whole dispute mechanism. There is no &quot;the box was down&quot; ticket because the renter&apos;s remedy - stop paying, now - does not need anyone&apos;s agreement.</p>
            </div>
          </section>

          <section id="supply" className="docs-sec">
            <span className="kicker">Mechanism</span>
            <h2>Real supply through <b>a relay</b></h2>
            <p>
              A marketplace with no machines is a contract with no purpose. Rentnode ships a
              relay - an ordinary provider process, open source, running under its own key - that
              mirrors a curated set of Vast.ai machine types onto the shelf, priced at Vast&apos;s
              live rate plus a margin, and fulfils leases with real instances.
            </p>
            <ul>
              <li><strong>Sync</strong> - every hour it asks Vast for the cheapest verified offer of each type and lists, reprices or closes accordingly. Every one of its listings says <span className="mono">via Vast.ai</span> in the spec.</li>
              <li><strong>Watch</strong> - every 15 seconds it polls <span className="mono">leaseCount</span>. A new lease on one of its listings rents a matching instance and attaches a fresh ssh key generated for that lease alone. If Vast has nothing, it closes the lease at once so the renter loses nothing.</li>
              <li><strong>Serve</strong> - its endpoint hands over ssh access to whoever can prove they are the renter (see Cryptography).</li>
              <li><strong>Settle</strong> - it claims what has accrued and destroys the instance when the lease closes or its runway hits zero.</li>
            </ul>
            <AccessDiagram />
            <div className="docs-note warn">
              <span className="n-ico">▲</span>
              <p>The relay is convenience, not protocol. It has no privileged role in the contract; if it went offline, its listings would go stale and anyone else&apos;s would be unaffected. Vast bills the relay operator in USD; renters pay the contract in USDG. The margin covers that gap.</p>
            </div>
          </section>

          <section id="custody" className="docs-sec">
            <span className="kicker">Trust</span>
            <h2>Who can <b>move what</b></h2>
            <p>
              The clearest way to state the custody model is as a permission table. Three actors
              exist: the renter, the provider, and Rentnode. The last column is empty on purpose.
            </p>
            <CustodyDiagram />
            <p>
              Concretely: no function in <span className="mono">ComputeMarket</span> is gated by an
              owner, admin, guardian or multisig role. There is no <span className="mono">Ownable</span>,
              no <span className="mono">Pausable</span>, no upgradeable proxy, no fee recipient. The
              deployer&apos;s key was used once, to deploy, and has no standing afterwards. The
              whole contract is under 240 lines - short enough to read in one sitting.
            </p>
          </section>

          <section id="cryptography" className="docs-sec">
            <span className="kicker">Trust</span>
            <h2>What the <b>cryptography</b> actually guarantees</h2>
            <p>
              Rentnode adds one signature scheme of its own - the access hand-over - and otherwise
              rests on the primitives of the chain. It is worth being precise about which ones do
              what.
            </p>
            <h3>Authorisation: ECDSA over secp256k1</h3>
            <p>
              Every state change is a transaction signed by an Ethereum account. The contract
              checks <span className="mono">msg.sender</span> against the lease: only the renter or
              the provider may close, only the provider may claim or reprice. Nobody, including
              Rentnode, can forge a signature for your key.
            </p>
            <h3>Access hand-over: EIP-191 personal_sign</h3>
            <p>
              The contract stores one endpoint per listing, but a lease belongs to one renter. So
              the console asks the renter to sign the plain message
              <span className="mono"> rentnode lease &lt;id&gt; &lt;unix minute&gt;</span> with the wallet
              that paid - no gas, no transaction. The relay recovers the signer with
              <span className="mono"> ecrecover</span>, reads <span className="mono">leaseAt(id).renter</span>
              from the chain, and returns the ssh host, port and private key only if they match.
              The minute in the message bounds replay to five minutes. The relay never learns the
              renter&apos;s wallet key, and no one else can fetch the ssh key.
            </p>
            <h3>Per-lease ssh keys: Ed25519</h3>
            <p>
              The relay generates a fresh Ed25519 keypair for every lease with
              <span className="mono"> ssh-keygen</span>, installs the public half on the instance,
              and hands the private half to the renter over the signed channel. Closing the lease
              destroys the instance; the key is worthless afterwards.
            </p>
            <h3>Integrity: the chain&apos;s consensus</h3>
            <p>
              Escrow balances are storage slots in a contract whose bytecode is fixed at deployment
              and hashed into every block that follows. Altering one would mean altering Robinhood
              Chain&apos;s history. This is the same guarantee that protects USDG itself.
            </p>
            <h3>Re-entrancy and token safety</h3>
            <p>
              The contract inherits OpenZeppelin&apos;s <span className="mono">ReentrancyGuard</span>;
              <span className="mono"> rent</span>, <span className="mono">topUp</span>,
              <span className="mono"> claim</span> and <span className="mono">close</span> are
              <span className="mono"> nonReentrant</span>. Transfers go through
              <span className="mono"> SafeERC20</span>, which reverts on tokens that return nothing
              instead of <span className="mono">true</span>. Amounts are <span className="mono">uint96</span>:
              large enough for any real lease, small enough that the whole lease packs into two
              storage slots.
            </p>
            <div className="docs-note">
              <span className="n-ico">◆</span>
              <p>There is no zero-knowledge, no encryption of listings, no off-chain signing service in the money path. What you see on-chain is the whole settlement system. The relay is the only off-chain component, and it can only do what any provider can.</p>
            </div>
          </section>

          <section id="risks" className="docs-sec">
            <span className="kicker">Trust</span>
            <h2>Risks and <b>limits</b></h2>
            <p>These are the things that can go wrong. They are real, and knowing them is the price of using a system nobody can pause.</p>
            <ul>
              <li><strong>The chain cannot see the hardware.</strong> A listing may be slower, smaller or deader than its spec claims. You pay for the seconds until you notice and close. Check a machine early; the first minute is cheap.</li>
              <li><strong>A dark provider still earns until you close.</strong> The meter runs on the clock, not on uptime. Set an alert on your own job, not on the contract.</li>
              <li><strong>The endpoint is public.</strong> Anyone can read it. A provider who puts a secret there has leaked it; use a relay-style signed hand-over or an authenticating host.</li>
              <li><strong>Relay counterparty.</strong> Leases on <span className="mono">via Vast.ai</span> listings depend on the relay process and the operator&apos;s Vast credit being alive. If either fails, close the lease; the contract refunds you regardless.</li>
              <li><strong>Immutability cuts both ways.</strong> A bug found after deployment stays. Fourteen tests cover metering, close-by-either-side, top-up, claim, the funded cap and a fuzz over timings that settles every lease to zero - but tests prove what was imagined.</li>
              <li><strong>Not a cloud.</strong> No SLA, no support desk, no recourse. That is the design.</li>
            </ul>
            <div className="docs-note warn">
              <span className="n-ico">▲</span>
              <p>Fund leases in small increments and top up as you go. The contract will happily hold a month of escrow, but there is no reason to give a stranger&apos;s clock more than an hour&apos;s head start.</p>
            </div>
          </section>

          <section id="reference" className="docs-sec">
            <span className="kicker">Protocol</span>
            <h2><b>Reference</b></h2>
            <h3>Deployed contracts - Robinhood Chain</h3>
            <div className="docs-table-wrap">
              <table className="docs-table">
                <thead><tr><th>Name</th><th>Role</th><th>Address</th></tr></thead>
                <tbody>
                  <tr><td className="name">ComputeMarket</td><td>Escrow, per-second metering, settlement</td><td><a href={`${EXPLORER}/${MARKET}`} target="_blank" rel="noreferrer"><span className="mono">{MARKET}</span></a></td></tr>
                  <tr><td className="name">USDG</td><td>Quote asset, 6 decimals</td><td><a href={`${EXPLORER}/${USDG}`} target="_blank" rel="noreferrer"><span className="mono">{USDG}</span></a></td></tr>
                  <tr><td className="name">Relay</td><td>Provider key of the Vast.ai relay - no special role</td><td><a href={`${EXPLORER}/${RELAY}`} target="_blank" rel="noreferrer"><span className="mono">{RELAY}</span></a></td></tr>
                </tbody>
              </table>
            </div>
            <h3>Functions</h3>
            <div className="docs-table-wrap">
              <table className="docs-table">
                <thead><tr><th>Function</th><th>Who</th><th>Effect</th></tr></thead>
                <tbody>
                  {FUNCTIONS.map(([fn, who, what]) => (
                    <tr key={fn}><td className="name"><span className="mono">{fn}</span></td><td>{who}</td><td>{what}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3>Errors</h3>
            <div className="docs-table-wrap">
              <table className="docs-table">
                <thead><tr><th>Error</th><th>When</th></tr></thead>
                <tbody>
                  {ERRORS.map(([e, when]) => (
                    <tr key={e}><td className="name"><span className="mono">{e}</span></td><td>{when}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3>Constants</h3>
            <div className="docs-table-wrap">
              <table className="docs-table">
                <thead><tr><th>Name</th><th>Value</th><th>Meaning</th></tr></thead>
                <tbody>
                  <tr><td className="name"><span className="mono">granularity</span></td><td>1 second</td><td>earned = pricePerHour × elapsed ÷ 3600</td></tr>
                  <tr><td className="name"><span className="mono">Kind</span></td><td>GPU · CPU · Storage · Database</td><td>Sorts the shelf; meaning of the spec is off-chain</td></tr>
                  <tr><td className="name"><span className="mono">relay MARGIN</span></td><td>15%</td><td>Over Vast&apos;s live price on relay listings</td></tr>
                  <tr><td className="name"><span className="mono">relay SYNC_MIN</span></td><td>60 minutes</td><td>How often relay listings are repriced</td></tr>
                  <tr><td className="name"><span className="mono">access window</span></td><td>5 minutes</td><td>Age past which a signed access request is refused</td></tr>
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>

      <footer className="docs-foot">
        <span>© {new Date().getFullYear()} Rentnode · one contract, no owner, no fee</span>
        <span style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <a href={SITE_URL}>Home</a>
          <a href={`${EXPLORER}/${MARKET}`} target="_blank" rel="noreferrer">Contract</a>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer">GitHub</a>
          <a href={APP_URL} className="dn-cta">Open the market ↗</a>
        </span>
      </footer>
    </div>
  );
}
