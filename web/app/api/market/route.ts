// Reads the marketplace straight off the chain: every listing, plus the
// caller's leases when an address is given. There is no database behind this -
// the contract is the only source of truth, and a page refresh re-reads it.

import { server, erc20Abi } from "../../../src/chain.ts";
import { MARKET, USDG, USDG_DECIMALS, marketAbi } from "../../../src/market.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const usd = (v: bigint) => Number(v) / 10 ** USDG_DECIMALS;

export interface Listing {
  id: number; provider: string; kind: number; pricePerHour: number; open: boolean;
  spec: string; endpoint: string;
}
export interface Lease {
  id: number; listingId: number; renter: string; provider: string;
  pricePerHour: number; funded: number; claimed: number;
  startAt: number; closedAt: number; earned: number; refundable: number; runway: number;
  spec: string; kind: number; endpoint: string;
}

/** Reads N items by index through one multicall rather than N round trips. */
async function readAll<T>(
  client: ReturnType<typeof server>,
  fn: "listingAt" | "leaseAt",
  ids: number[],
): Promise<(T | null)[]> {
  if (!ids.length) return [];
  const res = await client.multicall({
    allowFailure: true,
    contracts: ids.map((i) => ({
      address: MARKET as `0x${string}`, abi: marketAbi, functionName: fn, args: [BigInt(i)],
    })),
  });
  return res.map((r) => (r.status === "success" ? (r.result as T) : null));
}

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("address")?.trim() ?? "";
  const user = /^0x[a-fA-F0-9]{40}$/.test(raw) ? (raw as `0x${string}`) : null;

  if (!MARKET) {
    return Response.json(
      { deployed: false, listings: [], leases: [], usdg: 0 },
      { headers: { "cache-control": "no-store" } },
    );
  }

  const client = server();
  const out: {
    deployed: boolean; listings: Listing[]; leases: Lease[]; usdg: number;
  } = { deployed: true, listings: [], leases: [], usdg: 0 };

  try {
    const count = Number(await client.readContract({ address: MARKET, abi: marketAbi, functionName: "listingCount" }));
    const ids = Array.from({ length: count }, (_, i) => i);
    type RawListing = { provider: string; kind: number; pricePerHour: bigint; open: boolean; spec: string; endpoint: string };
    const rows = await readAll<RawListing>(client, "listingAt", ids);
    out.listings = rows.flatMap((l, i) =>
      l ? [{
        id: i, provider: l.provider, kind: Number(l.kind), pricePerHour: usd(l.pricePerHour),
        open: l.open, spec: l.spec, endpoint: l.endpoint,
      }] : []);
  } catch { /* leave the shelf empty rather than failing the page */ }

  if (user) {
    try {
      const [walletBal, leaseIds] = await Promise.all([
        client.readContract({ address: USDG, abi: erc20Abi, functionName: "balanceOf", args: [user] }),
        client.readContract({ address: MARKET, abi: marketAbi, functionName: "leasesOf", args: [user] }),
      ]);
      out.usdg = usd(walletBal as bigint);

      const ids = (leaseIds as readonly bigint[]).map(Number);
      type RawLease = {
        listingId: bigint; renter: string; provider: string; pricePerHour: bigint;
        funded: bigint; claimed: bigint; startAt: bigint; closedAt: bigint;
      };
      const rows = await readAll<RawLease>(client, "leaseAt", ids);

      // earned/refundable/runway are contract views, so the numbers on screen
      // are the ones the contract would settle with - not a guess made here.
      const live = await client.multicall({
        allowFailure: true,
        contracts: ids.flatMap((i) => ([
          { address: MARKET as `0x${string}`, abi: marketAbi, functionName: "earned" as const, args: [BigInt(i)] },
          { address: MARKET as `0x${string}`, abi: marketAbi, functionName: "refundable" as const, args: [BigInt(i)] },
          { address: MARKET as `0x${string}`, abi: marketAbi, functionName: "runway" as const, args: [BigInt(i)] },
        ])),
      });

      out.leases = rows.flatMap((l, n) => {
        if (!l) return [];
        const listing = out.listings[Number(l.listingId)];
        const at = (k: number) => (live[n * 3 + k]?.status === "success" ? (live[n * 3 + k].result as bigint) : 0n);
        return [{
          id: ids[n], listingId: Number(l.listingId), renter: l.renter, provider: l.provider,
          pricePerHour: usd(l.pricePerHour), funded: usd(l.funded), claimed: usd(l.claimed),
          startAt: Number(l.startAt), closedAt: Number(l.closedAt),
          earned: usd(at(0)), refundable: usd(at(1)), runway: Number(at(2)),
          spec: listing?.spec ?? "", kind: listing?.kind ?? 0, endpoint: listing?.endpoint ?? "",
        }];
      });
    } catch { /* keep whatever loaded */ }
  }

  return Response.json(out, { headers: { "cache-control": "no-store" } });
}
