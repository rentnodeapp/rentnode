import { Mark } from "./icons.tsx";
import { HeroTerminal, SupplyPanel, SettlementPanel } from "./terminal.tsx";

/* Section numbering, a stat strip, spec rows and dark instrument panels - the
   reference's structure. Every figure below is something the contract does or
   a constant in it; none of it is decorative filler. */

const STATS: [string, string][] = [
  ["1 SECOND", "BILLING GRANULARITY"],
  ["0", "MINIMUM TERM"],
  ["100%", "OF UNUSED ESCROW REFUNDED"],
  ["4663", "ROBINHOOD CHAIN"],
];

const STEPS: [string, string, string][] = [
  ["01", "List", "A provider publishes a machine and an hourly price. No deposit, no application, no approval queue. The listing is a claim they make."],
  ["02", "Escrow", "A renter funds however many hours they want. The USDG sits in the contract; nobody can move it but the metering."],
  ["03", "Meter", "Payment accrues to the provider second by second. They may withdraw the earned part at any moment without ending the lease."],
  ["04", "Stop", "Either side closes. Earned goes to the provider, the entire remainder returns to the renter, in one transaction."],
];

const SPECS: [string, string][] = [
  ["Quote asset", "USDG, 6 decimals"],
  ["Rate stored", "Per hour; metered per second"],
  ["Rate on a live lease", "Frozen at rent() — a price change cannot reach it"],
  ["Overrun behaviour", "Earnings stop at the funded amount. A lease never goes into debt"],
  ["Who may close", "Renter or provider, at any second"],
  ["Owner / pause / fee", "None. There is no admin key and no upgrade path"],
  ["Dispute process", "None, by design. Closing is the remedy"],
];

export default function Landing() {
  return (
    <div>
      <nav className="nav">
        <a className="brand" href="/"><Mark />Compute</a>
        <div className="nav-links">
          <a href="#how">How</a>
          <a href="#spec">Spec</a>
          <a href="#honest">The line</a>
          <a href="/app">Market</a>
        </div>
        <a className="btn sm primary" href="/app" style={{ marginLeft: 18 }}>Open the market</a>
      </nav>

      {/* ---- hero ---- */}
      <header className="hero-wrap" style={{ borderBottom: "var(--rule)" }}>
        <div className="wrap" style={{ padding: "clamp(36px,5vw,72px) var(--gutter) clamp(40px,6vw,80px)" }}>
          <div className="g2 hero">
            <div>
              <div className="pill"><span>LIVE · CHAIN 4663 · SETTLEMENT ONLY</span></div>
              <h1 className="display lg">Rent the machine,<br />pay by the <em>second</em>.</h1>
              <p className="kicker">
                GPUs, CPUs, disks and databases from whoever has them spare. Escrow USDG, and
                the money moves to the provider one second at a time. Stop whenever it stops
                being worth it — the rest comes straight back.
              </p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <a className="btn primary" href="/app">Open the market →</a>
                <a className="btn" href="#spec">Read the spec</a>
              </div>
            </div>
            <HeroTerminal />
          </div>
        </div>
        <div className="wrap" style={{ paddingBottom: 0 }}>
          <div className="stats">
            {STATS.map(([v, l]) => <div key={l}><b>{v}</b><span>{l}</span></div>)}
          </div>
        </div>
      </header>

      {/* ---- §01 how ---- */}
      <section className="sec" id="how">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <div className="pill"><span>§01 — The mechanism</span></div>
              <h2 className="display">Four steps, and none of them<br />need a middleman.</h2>
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

      {/* ---- §02 supply ---- */}
      <section className="sec" id="supply">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <div className="pill"><span>§02 — Supply</span></div>
              <h2 className="display">Anyone can put a<br />machine on the shelf.</h2>
            </div>
            <p>
              There is no deposit and no vetting, because a deposit only gates entry unless
              somebody can judge when to seize it — and nobody here can. Reputation is the lease
              history, which is public and cannot be edited.
            </p>
          </div>
          <div className="g2" style={{ gap: 18 }}>
            <SupplyPanel />
            <div className="panel">
              <div className="card-head"><span className="k">Provider ledger</span><span className="k live">metered</span></div>
              <div style={{ padding: 20 }}>
                <div className="spec" style={{ borderColor: "var(--panel-line)" }}><span style={{ color: "var(--panel-dim)" }}>Earns</span><b>Per second, from block time</b></div>
                <div className="spec" style={{ borderColor: "var(--panel-line)" }}><span style={{ color: "var(--panel-dim)" }}>Withdraw</span><b>Any time, without ending the lease</b></div>
                <div className="spec" style={{ borderColor: "var(--panel-line)" }}><span style={{ color: "var(--panel-dim)" }}>Price change</span><b>Binds new leases only</b></div>
                <div className="spec" style={{ borderColor: "var(--panel-line)", borderBottom: 0 }}><span style={{ color: "var(--panel-dim)" }}>Cost to list</span><b>One transaction of gas</b></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---- §03 spec ---- */}
      <section className="sec" id="spec">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <div className="pill"><span>§03 — Datasheet</span></div>
              <h2 className="display">What the contract<br />actually does.</h2>
            </div>
            <p>
              Six functions: <span className="mono">list</span>, <span className="mono">updateListing</span>,{" "}
              <span className="mono">rent</span>, <span className="mono">topUp</span>,{" "}
              <span className="mono">claim</span>, <span className="mono">close</span>. Fourteen tests,
              including a 256-run fuzz proving it always settles to a zero balance.
            </p>
          </div>
          <div className="g2" style={{ gap: 18 }}>
            <div className="specs">
              {SPECS.map(([k, v]) => <div className="spec" key={k}><span>{k}</span><b>{v}</b></div>)}
            </div>
            <SettlementPanel />
          </div>
        </div>
      </section>

      {/* ---- §04 the line ---- */}
      <section className="sec" id="honest">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <div className="pill"><span>§04 — The line</span></div>
              <h2 className="display">It settles money.<br />It does not run <em>machines</em>.</h2>
            </div>
            <p>
              Worth saying plainly, because most marketplaces bury it: this contract has no way
              to see the hardware. A listing is a claim its provider makes, not a fact anybody
              verified.
            </p>
          </div>
          <div className="g2">
            <div className="card">
              <div className="card-head"><span className="k">What you get</span><span className="chip on">Guaranteed</span></div>
              <div className="card-pad">
                <p style={{ margin: 0, color: "var(--ink-2)" }}>
                  Escrow nobody can take early. Metering that cannot be sped up. A refund of every
                  unused second, paid in the same transaction that closes the lease. No owner can
                  freeze it, and no fee is skimmed on the way through.
                </p>
              </div>
            </div>
            <div className="card">
              <div className="card-head"><span className="k">What you do not</span><span className="chip warn">Off-chain</span></div>
              <div className="card-pad">
                <p style={{ margin: 0, color: "var(--ink-2)" }}>
                  No uptime promise, no benchmark, no proof the GPU is the one advertised. Your
                  protection is that leaving costs you nothing but the seconds already spent —
                  so try a small lease before a long one.
                </p>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 36 }}>
            <a className="btn primary" href="/app">Open the market →</a>
          </div>
        </div>
      </section>

      <footer className="foot">
        <div className="wrap foot-in">
          <span className="brand"><Mark />Compute</span>
          <span className="sp" />
          <span>Non-custodial · no owner · no fee · no pause switch</span>
        </div>
      </footer>
    </div>
  );
}
