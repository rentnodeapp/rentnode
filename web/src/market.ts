/** USDG on RH Chain - 6 decimals, the quote currency for every lease. */
export const USDG = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168" as const;
export const USDG_DECIMALS = 6;

/** The marketplace contract. Empty until deployed; the UI checks before signing. */
export const MARKET = (process.env.NEXT_PUBLIC_MARKET_ADDRESS ?? "") as `0x${string}` | "";

/** Matches the contract's Kind enum, by index. */
export const KINDS = ["GPU", "CPU", "Storage", "Database"] as const;
export type Kind = (typeof KINDS)[number];

export const erc20ApproveAbi = [
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

const listingTuple = {
  type: "tuple",
  components: [
    { name: "provider", type: "address" },
    { name: "kind", type: "uint8" },
    { name: "pricePerHour", type: "uint96" },
    { name: "open", type: "bool" },
    { name: "spec", type: "string" },
    { name: "endpoint", type: "string" },
  ],
} as const;

const leaseTuple = {
  type: "tuple",
  components: [
    { name: "listingId", type: "uint64" },
    { name: "renter", type: "address" },
    { name: "provider", type: "address" },
    { name: "pricePerHour", type: "uint96" },
    { name: "funded", type: "uint96" },
    { name: "claimed", type: "uint96" },
    { name: "startAt", type: "uint64" },
    { name: "closedAt", type: "uint64" },
  ],
} as const;

export const marketAbi = [
  { type: "function", name: "list", stateMutability: "nonpayable", inputs: [
    { name: "kind", type: "uint8" }, { name: "pricePerHour", type: "uint96" },
    { name: "spec", type: "string" }, { name: "endpoint", type: "string" },
  ], outputs: [{ type: "uint256" }] },
  { type: "function", name: "updateListing", stateMutability: "nonpayable", inputs: [
    { type: "uint256" }, { name: "pricePerHour", type: "uint96" }, { name: "endpoint", type: "string" }, { name: "open", type: "bool" },
  ], outputs: [] },
  { type: "function", name: "rent", stateMutability: "nonpayable", inputs: [{ type: "uint256" }, { type: "uint96" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "topUp", stateMutability: "nonpayable", inputs: [{ type: "uint256" }, { type: "uint96" }], outputs: [] },
  { type: "function", name: "claim", stateMutability: "nonpayable", inputs: [{ type: "uint256" }], outputs: [{ type: "uint96" }] },
  { type: "function", name: "close", stateMutability: "nonpayable", inputs: [{ type: "uint256" }], outputs: [] },
  { type: "function", name: "earned", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "uint96" }] },
  { type: "function", name: "refundable", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "uint96" }] },
  { type: "function", name: "runway", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "uint64" }] },
  { type: "function", name: "listingCount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "leaseCount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "listingAt", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [listingTuple] },
  { type: "function", name: "leaseAt", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [leaseTuple] },
  { type: "function", name: "listingsOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256[]" }] },
  { type: "function", name: "leasesOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256[]" }] },
] as const;

/** Seconds rendered the way people say them: "3d 4h", "2h 15m", "45s". */
export function humanDuration(secs: number): string {
  if (secs <= 0) return "0s";
  const d = Math.floor(secs / 86400), h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60), s = Math.floor(secs % 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}
