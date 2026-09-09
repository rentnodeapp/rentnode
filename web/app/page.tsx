import { Icon, Mark, Arrow } from "./icons.tsx";

/* Three claims, and each is something the contract actually does. Nothing here
   promises uptime or performance - the chain settles money, it does not run
   machines, and the copy has to stay inside that line. */
const FEATURES: [number, string, string][] = [
  [0, "Metered by the second", "Fund an hour or a hundred. Payment flows to the provider second by second, never as an upfront lump the renter cannot get back."],
  [2, "Stop and get the rest", "Close a lease at any second and every unspent cent returns in the same transaction. That is the whole protection - no ticket, no arbiter."],
  [3, "Anyone can supply", "No deposit, no application, no gatekeeper. List a box, set a price, withdraw earnings whenever you like."],
];

export default function Landing() {
  return (
    <div>
      <nav className="nav">
        <div className="wrap nav-in">
          <span className="brand"><Mark />Ascend</span>
          <span className="sp" />
          <div className="nav-links">
            <a className="on" href="/">Home</a>
            <a href="#how">How it works</a>
            <a href="#supply">Supply</a>
            <a href="/app">Market</a>
          </div>
          <span className="sp" />
          <a className="btn sm" href="/app">Get Started</a>
        </div>
      </nav>

      {/* ---- hero ---- */}
      <header className="wrap" style={{ textAlign: "center", padding: "56px 24px 8px" }}>
        <span className="badge"><b>New</b>Compute settled on RH Chain</span>
        <h1 className="h1" style={{ margin: "24px auto 0", maxWidth: "16ch" }}>
          Rent compute by the <span className="mark">second</span>
        </h1>
        <p className="lede" style={{ margin: "22px auto 0", maxWidth: "54ch" }}>
          GPUs, CPUs, disks and databases from whoever has them spare. Escrow USDG, pay only
          for the seconds you use, and stop the moment it stops being worth it.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 30 }}>
          <a className="btn" href="/app">Start Now <Arrow /></a>
          <a className="btn ghost" href="#how">How it works</a>
        </div>
      </header>

      {/* ---- three cards, as in the reference ---- */}
      <section className="wrap" id="how" style={{ paddingTop: 56, paddingBottom: 24 }}>
        <div className="grid">
          {FEATURES.map(([k, title, body], i) => (
            <div className="card" key={title} style={{ transform: `rotate(${(i - 1) * 0.7}deg)`, padding: 24 }}>
              <h3 style={{ margin: "0 0 6px", fontSize: 19, fontWeight: 700, letterSpacing: "-0.025em" }}>{title}</h3>
              <p className="lede" style={{ fontSize: 13.5, marginBottom: 20 }}>{body}</p>
              <div style={{ display: "grid", placeItems: "center", paddingTop: 4 }}><Icon kind={k} size={84} /></div>
            </div>
          ))}
        </div>
      </section>

      {/* ---- the honest bit, stated rather than buried ---- */}
      <section className="wrap" id="supply" style={{ padding: "48px 24px 90px" }}>
        <div className="shell" style={{ gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div className="card" style={{ padding: 30 }}>
            <h2 className="h2" style={{ fontSize: 26 }}>What this is</h2>
            <p className="lede" style={{ marginTop: 12, fontSize: 14 }}>
              A settlement rail for rented infrastructure. The contract escrows USDG and meters
              it out per second while a lease runs. Providers withdraw earnings whenever they
              want; renters close whenever they want. No owner, no fee, no pause switch.
            </p>
          </div>
          <div className="summary" style={{ padding: 30 }}>
            <h3 style={{ fontSize: 26, letterSpacing: "-0.03em" }}>What it isn&apos;t</h3>
            <p className="lede" style={{ marginTop: 12, fontSize: 14 }}>
              It is not a compute network, and it cannot see your machine. A listing is a claim
              its provider makes, not a fact anyone verified. That is exactly why closing is
              instant: your protection is the refund, not a promise.
            </p>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 40 }}>
          <a className="btn" href="/app">Open the market <Arrow /></a>
        </div>
      </section>

      <footer style={{ borderTop: "1px solid var(--line)", padding: "26px 0 46px" }}>
        <div className="wrap" style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", fontSize: 12.5, color: "var(--dim)" }}>
          <span className="brand" style={{ fontSize: 16 }}><Mark />Ascend</span>
          <span className="sp" />
          <span>Non-custodial. No owner, no fee, no pause switch.</span>
        </div>
      </footer>
    </div>
  );
}
