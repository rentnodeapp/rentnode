"use client";

import { useEffect, useState } from "react";
import { Icon } from "./icons.tsx";
import { KINDS } from "../src/market.ts";
import type { Listing } from "./api/market/route.ts";

/** The live shelf on the landing: whatever is actually listed right now,
 *  read off the contract. Empty is shown as empty - no placeholder machines. */
export function LiveShelf() {
  const [rows, setRows] = useState<Listing[] | null>(null);
  useEffect(() => {
    let on = true;
    fetch("/api/market").then((r) => r.json()).then((j) => on && setRows((j.listings ?? []) as Listing[])).catch(() => on && setRows([]));
    return () => { on = false; };
  }, []);

  const open = (rows ?? []).filter((l) => l.open);
  return (
    <div className="card">
      <div className="card-head">
        <span className="k">Shelf · read from chain</span>
        <span className="k live">{rows === null ? "reading" : `${open.length} listed`}</span>
      </div>
      {rows === null ? <div className="empty">Reading the contract…</div>
        : open.length === 0 ? (
          <div className="card-pad" style={{ gap: 10 }}>
            <p className="kicker" style={{ margin: 0, fontSize: 15 }}>
              Nothing listed yet. The shelf fills the moment a provider publishes a machine -
              there is no gatekeeper, no deposit and no approval queue.
            </p>
            <a className="btn sm mint" href="/app" style={{ alignSelf: "start" }}>Be the first to list →</a>
          </div>
        ) : (
          <div className="shelf-rows">
            {open.slice(0, 4).map((l, i) => (
              <a className="shelf-row" href="/app" key={l.id}>
                <span className="shelf-ic"><Icon kind={l.kind} size={30} i={i} /></span>
                <span className="shelf-id"><b>{l.spec.split("/")[0]?.trim() || KINDS[l.kind]}</b><small>{l.spec}</small></span>
                <span className="shelf-p">{l.pricePerHour.toFixed(2)}<i> USDG/hr</i></span>
              </a>
            ))}
          </div>
        )}
    </div>
  );
}
