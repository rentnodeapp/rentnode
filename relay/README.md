# Rentnode relay

Real supply for the shelf. The relay is a provider like any other: it lists
Vast.ai machine types on the contract under its own key, and when somebody
rents one it rents a matching instance on Vast, hands the renter an ssh key,
and settles. Every listing it creates says `via Vast.ai` in the spec.

## What it needs

| Input | Why | Where |
|---|---|---|
| `VAST_API_KEY` | to search offers, create and destroy instances | console.vast.ai → Account → API Keys |
| Vast credit | Vast bills your account in USD per second; renters pay the contract in USDG | console.vast.ai → Billing (start with $20–50) |
| `RELAY_PRIVATE_KEY` | signs `list`, `updateListing`, `claim`, `close`; receives the USDG | generated once, see `.env.example` |
| ~0.002 ETH on that key | gas on RH Chain | send to the relay address |
| a host that stays up | the loop and the `/lease/:id` endpoint | any $5 VPS; `ssh-keygen` must be on PATH |

## Run

```
cp .env.example .env      # fill in the two keys
npm install
npm start
```

Set `PUBLIC_URL` to the address renters can reach the relay at (for example
`https://relay.rentnode.example`). It is written into every listing's
`endpoint`, and the app calls `${endpoint}/<leaseId>` to fetch ssh access.

## How access is handed over

The contract stores one `endpoint` per listing, but a lease is per renter.
So the endpoint is a URL, and the app has the renter sign
`rentnode lease <id> <unix minute>` with the wallet that paid. The relay
recovers the signer, checks it against `lease.renter` on-chain, and only
then returns host, port and the private key it generated for that lease.
Nobody else can fetch it; the relay never learns the renter's wallet key.

## Money

- Listing price = Vast `dph_total` × (1 + `MARGIN`). Default margin 15 %.
- The relay claims accrued USDG once it exceeds 1 USDG per lease.
- If Vast has no matching offer at rent time, the relay closes the lease in
  the same minute so the renter is refunded in full.
- When the renter closes, or runway hits zero, the instance is destroyed.

You carry the FX between USDG in and USD out, and the cost of any instance
that fails to boot. Keep the catalogue small until you have seen a week of
it.
