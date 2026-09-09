"use client";

import { useEffect, useState } from "react";
import { Mark } from "./icons.tsx";

const LINKS: [string, string][] = [
  ["#how", "How"],
  ["#supply", "Supply"],
  ["#spec", "Spec"],
  ["#honest", "The line"],
  ["/app", "Market"],
];

/** The marketing nav. Below 900px the links move into a drawer rather than
 *  vanishing, which is what they were doing before. */
export function SiteNav() {
  const [open, setOpen] = useState(false);

  // a drawer that outlives the page it belongs to is a trap on a phone
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", key);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <nav className="nav">
        <a className="brand" href="/"><Mark /><span>Compute</span></a>

        <div className="nav-links">
          {LINKS.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
        </div>

        <a className="btn sm primary nav-cta" href="/app">Open the market</a>

        <button
          className={`burger${open ? " open" : ""}`}
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          <i /><i /><i />
        </button>
      </nav>

      {open && (
        <>
          <button className="drawer-veil" onClick={() => setOpen(false)} aria-label="Close menu" />
          <div className="drawer">
            {LINKS.map(([href, label]) => (
              <a key={href} href={href} onClick={() => setOpen(false)}>
                <span>{label}</span><span className="k">→</span>
              </a>
            ))}
            <a className="btn primary wide" href="/app" onClick={() => setOpen(false)}>Open the market</a>
          </div>
        </>
      )}
    </>
  );
}
