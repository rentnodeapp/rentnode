import { Mark } from "./icons.tsx";
import { Hero } from "./hero.tsx";
import { Typed } from "./type.tsx";
import { HeroTerminal, SupplyPanel, SettlementPanel } from "./terminal.tsx";
import { LiveShelf } from "./shelf.tsx";

/* The RH-4 page shape - numbered sections, stat strips, spec rows, dark
   instrument panels, an opcode-style table, a deployment table, a roadmap -
   filled with what this contract actually does. Every figure is a constant
   in the source or a live read; nothing is decorative filler. */

const MARKET = "0xd172e6Aa54e2D04F4168a339B63F284c99162D9d";
const EXPLORER = `https://robinhoodchain.blockscout.com/address/${MARKET}`;

const STATS: [string, string][] = [
  ["1 SECOND", "BILLING GRANULARITY"],
  ["0", "MINIMUM TERM · DEPOSIT · FEE"],
  ["100%", "OF UNUSED ESCROW REFUNDED"],
  ["6", "FUNCTIONS, NO OWNER"],
];

const STEPS: [string, string, string][] = [
  ["01", "List", "A provider publishes a machine and an hourly price. No deposit, no application, no approval queue. The listing is a claim they make."],
  ["02", "Escrow", "A renter funds however many hours they want. The USDG sits in the contract; nobody can move it but the metering."],
  ["03", "Meter", "Payment accrues to the provider second by second. They may withdraw the earned part at any moment without ending the lease."],
  ["04", "Stop", "Either side closes. Earned goes to the provider, the entire remainder returns to the renter, in one transaction."],
];

const PIPE: [string, string, string][] = [
  ["list()", "Provider", "Kind, spec, endpoint and USDG/hour go on-chain. One transaction of gas."],
  ["rent()", "Renter", "Escrows USDG. The rate is frozen at this moment; a later price change cannot touch it."],
  ["tick", "Block time", "Every second the lease earns pricePerHour / 3600, capped at what was funded."],
  ["claim()", "Provider", "Withdraws earned-so-far. The lease keeps running."],
  ["close()", "Either side", "Earned to the provider, the rest to the renter, contract balance for this lease returns to zero."],
];

const FN: [string, string, string, string][] = [
  ["list", "kind, pricePerHour, spec, endpoint", "Puts a machine on the shelf", "anyone"],
  ["updateListing", "id, pricePerHour, endpoint, open", "Reprices or closes a listing; live leases unaffected", "provider"],
  ["rent", "listingId, amount", "Escrows USDG and starts the clock", "anyone"],
  ["topUp", "leaseId, amount", "Extends the runway of a running lease", "anyone"],
  ["claim", "leaseId", "Pays the provider what has accrued", "provider"],
  ["close", "leaseId", "Settles both sides and ends the lease", "renter or provider"],
];

const DEPLOY: [string, React.ReactNode][] = [
  ["Status", <span className="live" key="s">LIVE</span>],
  ["Network", "ROBINHOOD CHAIN / 4663"],
  ["Contract", <a key="c" href={EXPLORER} target="_blank" rel="noreferrer" className="mono">{MARKET.slice(0, 6)}…{MARKET.slice(-4)} ↗</a>],
  ["Quote asset", "USDG · 6 DECIMALS"],
  ["Metering", "PER SECOND FROM BLOCK TIME"],
  ["Admin key", "NONE · NO PAUSE · NO UPGRADE"],
];

const POINT: [string, string, string][] = [
  ["NOW", "A settlement rail", "Escrow, per-second metering, instant close. Live on RH Chain. The chain settles money; it does not see the machine."],
  ["NEXT", "Reputation from the ledger", "Lease history is public and cannot be edited. A provider page that reads it - hours served, closes by renters, average tenure - with no new trust assumption."],
  ["GOAL", "Receipts for work", "A renter-signed attestation that a job completed, anchored on-chain. Still no arbiter: a receipt is evidence a provider can show, not a judgement."],
];

const ROAD: [string, string, string[]][] = [
  ["R1", "The shelf opens", ["Listings, escrow, metering, close - shipped", "Browser wallet, no login", "Verified source on Blockscout"]],
  ["R2", "Provider pages", ["Ledger-derived reputation", "Endpoint health pings, off-chain, advisory only", "Top-up from any address"]],
  ["R3", "Receipts", ["Renter-signed completion receipts", "Job manifests hashed into the lease", "Provider portfolios built from receipts"]],
  ["R4", "Compute you can prove", ["Verifiable execution for narrow workloads", "Dispute bisection where a proof exists", "The point at which the chain can see the machine"]],
];

export default function Landing() {
  return (
    <div>
      <Hero />

      {/* ---- the meter, and the figures the hero used to carry ---- */}
      <section className="sec" id="meter">
        <div className="wrap">
          <div className="g2 hero">
            <div>
              <div className="pill"><span>LIVE · CHAIN 4663 · SETTLEMENT ONLY</span><span className="mono" style={{ fontSize: 10.5 }}>{MARKET.slice(0, 6)}…{MARKET.slice(-4)}</span></div>
              <h2 className="display"><Typed text="The meter, running." /></h2><i className="wipe" />
              <p className="kicker">
                A lease in front of you: the command types itself out, then elapsed, spent,
                refundable and runway tick over per second against a consumption bar. The
                arithmetic is the contract&apos;s - same rate, same accrual, same runway.
              </p>
            </div>
            <HeroTerminal />
          </div>
          <div className="stats" style={{ marginTop: 40 }}>{STATS.map(([v, l]) => <div key={l}><b>{v}</b><span>{l}</span></div>)}</div>
        </div>
      </section>

      {/* ---- §01 mechanism ---- */}
      <section className="sec" id="how">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <div className="pill"><span>§01 — The mechanism</span></div>
              <h2 className="display">Four steps, and none of them need a middleman.</h2><i className="wipe" />
            </div>
            <p>
              A marketplace like this normally needs an arbiter to settle &ldquo;the box was
              down&rdquo; arguments, and an arbiter is a person who can be captured. Instant
              closing removes the need for one: a provider who goes dark stops being paid within
              seconds of being noticed, so the worst outcome is too small to need a judge.
            </p>
          </div>
          <div className="g4">
            {STEPS.map(([n, t, b]) => (
              <div className="card" key={n}>
                <div className="card-head"><span className="num">{n}</span><span className="k">{t}</span></div>
                <div className="card-pad"><p style={{ margin: 0, color: "var(--ink-2)", fontSize: 15.5 }}>{b}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- §02 the shelf ---- */}
      <section className="sec" id="shelf">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <div className="pill"><span>§02 — The shelf</span></div>
              <h2 className="display">Watch it fill.</h2><i className="wipe" />
            </div>
            <p>
              This is not a mock. The panel on the left reads <span className="mono">listingCount</span>
              off the contract and shows whatever is there - including nothing, when nothing is
              there. The ledger on the right is a demonstration of how a provider&apos;s side
              accrues once the shelf is stocked.
            </p>
          </div>
          <div className="g2" style={{ gap: 18 }}>
            <LiveShelf />
            <SupplyPanel />
          </div>
        </div>
      </section>

      {/* ---- §03 supply ---- */}
      <section className="sec" id="supply">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <div className="pill"><span>§03 — Supply</span></div>
              <h2 className="display">Put a machine on the shelf.</h2><i className="wipe" />
            </div>
            <p>
              There is no deposit and no vetting, because a deposit only gates entry unless
              somebody can judge when to seize it - and nobody here can. Reputation is the lease
              history, which is public and cannot be edited.
            </p>
          </div>
          <div className="g2" style={{ gap: 18 }}>
            <div className="specs">
              <div className="spec"><span>Kind</span><b>GPU · CPU · Storage · Database - one enum, free-text spec</b></div>
              <div className="spec"><span>Price</span><b>USDG per hour, 6 decimals. Metered per second from it</b></div>
              <div className="spec"><span>Endpoint</span><b>Stored in the clear. Publish a hostname, never a key</b></div>
              <div className="spec"><span>Reprice</span><b>Binds new leases only. A live lease keeps its rate</b></div>
              <div className="spec"><span>Withdraw</span><b>Any second, without ending the lease</b></div>
              <div className="spec"><span>Cost to list</span><b>One transaction of gas. Nothing else</b></div>
            </div>
            <div className="panel">
              <div className="card-head"><span className="k">A listing, as stored</span><span className="k live">struct</span></div>
              <pre className="code">{`struct Listing {
  address provider;      // msg.sender at list()
  Kind    kind;          // GPU | CPU | Storage | Database
  uint96  pricePerHour;  // USDG, 6 decimals
  bool    open;          // provider may close it
  string  spec;          // "RTX 4090 / 24GB / eu-central"
  string  endpoint;      // "ssh://box.example:22"
}`}</pre>
            </div>
          </div>
        </div>
      </section>

      {/* ---- §04 lifecycle ---- */}
      <section className="sec" id="lifecycle">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <div className="pill"><span>§04 — Lifecycle</span></div>
              <h2 className="display">From listing to zero balance.</h2><i className="wipe" />
            </div>
            <p>
              Five moments. Two are transactions the provider sends, two the renter, and one is
              just the chain&apos;s clock. The invariant across all five: the contract&apos;s
              balance for a lease always equals funded minus claimed, and it ends at zero.
            </p>
          </div>
          <div className="pipe">
            {PIPE.map(([f, who, d], i) => (
              <div className="pipe-s" key={f}>
                <span className="num">0{i + 1}</span>
                <b className="mono">{f}</b>
                <span className="k">{who}</span>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- §05 function set ---- */}
      <section className="sec" id="functions">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <div className="pill"><span>§05 — Function set</span></div>
              <h2 className="display">Six functions.</h2><i className="wipe" />
            </div>
            <p>
              The whole external surface. No owner-only functions exist because there is no owner.
              Fourteen tests cover it, including a 256-run fuzz over funding and timing that proves
              settlement always returns the contract to a zero balance.
            </p>
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Function</th><th>Arguments</th><th>Effect</th><th>Caller</th></tr></thead>
              <tbody>
                {FN.map(([n, a, e, w]) => (
                  <tr key={n}><td className="mono hi">{n}</td><td className="mono">{a}</td><td>{e}</td><td className="k">{w}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ---- §06 deployment ---- */}
      <section className="sec" id="deploy">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <div className="pill"><span>§06 — Deployment</span></div>
              <h2 className="display">Nobody owns the clock.</h2><i className="wipe" />
            </div>
            <p>
              The deployer&apos;s key was used once, to deploy, and has no standing afterwards.
              What is at this address is final - every guarantee on this page, and every bug.
            </p>
          </div>
          <div className="g2" style={{ gap: 18 }}>
            <div className="specs">
              {DEPLOY.map(([k, v]) => <div className="spec" key={k}><span>{k}</span><b>{v}</b></div>)}
            </div>
            <SettlementPanel />
          </div>
        </div>
      </section>

      {/* ---- §07 the point ---- */}
      <section className="sec" id="honest">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <div className="pill"><span>§07 — The point</span></div>
              <h2 className="display">It settles money. It does not run <em>machines</em>.</h2><i className="wipe" />
            </div>
            <p>
              Worth saying plainly, because most marketplaces bury it: this contract has no way
              to see the hardware. A listing is a claim its provider makes, not a fact anybody
              verified. Your protection is that leaving costs you nothing but the seconds spent.
            </p>
          </div>
          <div className="g3">
            {POINT.map(([t, h, b]) => (
              <div className="card" key={t}>
                <div className="card-head"><span className="num">{t}</span><span className="k">{t === "NOW" ? "shipped" : t === "NEXT" ? "planned" : "research"}</span></div>
                <div className="card-pad"><h3 className="display xs">{h}</h3><p style={{ margin: 0, color: "var(--ink-2)", fontSize: 15 }}>{b}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- §08 roadmap ---- */}
      <section className="sec" id="roadmap">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <div className="pill"><span>§08 — Roadmap</span></div>
              <h2 className="display">What ships, in order.</h2><i className="wipe" />
            </div>
            <p>R1 is live. Everything after it adds information around the rail without adding a party who can override it.</p>
          </div>
          <div className="road">
            {ROAD.map(([r, t, items]) => (
              <div className="road-r" key={r}>
                <span className="num">{r}</span>
                <div><b>{t}</b><ul>{items.map((x) => <li key={x}>{x}</li>)}</ul></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- §09 design ---- */}
      <section className="sec" id="design">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <div className="pill"><span>§09 — The design</span></div>
              <h2 className="display">Ours, end to end.</h2><i className="wipe" />
            </div>
            <p>
              One contract, written for this, not forked. Solidity 0.8.28, OpenZeppelin&apos;s
              ReentrancyGuard and SafeERC20, Foundry for the tests, Next.js for the window onto
              it. The stack is short because the idea is short.
            </p>
          </div>
          <div className="stack">
            {["SOLIDITY", "FOUNDRY", "REENTRANCYGUARD", "SAFEERC20", "USDG", "RH CHAIN 4663", "NEXT.JS"].map((s, i, a) => (
              <span key={s}><b>{s}</b>{i < a.length - 1 && <i>→</i>}</span>
            ))}
          </div>
          <div style={{ marginTop: 36, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a className="btn primary" href="/app">Open the market →</a>
            <a className="btn" href={EXPLORER} target="_blank" rel="noreferrer">Contract on Blockscout ↗</a>
          </div>
        </div>
      </section>

      <footer className="foot">
        <div className="wrap foot-in">
          <span className="brand"><Mark />Rentnode</span>
          <span className="sp" />
          <span>Non-custodial · no owner · no fee · no pause switch</span>
        </div>
      </footer>
    </div>
  );
}
