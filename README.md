<p align="center">
  <img src="web/public/logo.png" width="96" alt="Rentnode" />
</p>

<h1 align="center">Rentnode</h1>

<p align="center">
  Rent compute by the second.<br />
  GPUs, CPUs, disks and databases from whoever has them spare, escrowed in USDG and metered per second on Robinhood Chain.
</p>

<p align="center">
  <a href="https://rentnode.org">rentnode.org</a> ·
  <a href="https://app.rentnode.org">console</a> ·
  <a href="https://rentnode.org/docs">docs</a> ·
  <a href="https://robinhoodchain.blockscout.com/address/0xd172e6Aa54e2D04F4168a339B63F284c99162D9d">contract</a>
</p>

---

## What it is

A marketplace for rented infrastructure reduced to the one thing a chain can actually do: hold money and meter it out per second.

- **List** - a provider publishes a machine and an hourly price. No deposit, no application, no approval queue.
- **Escrow** - a renter funds however many hours they want. The USDG sits in the contract; nobody can move it but the metering.
- **Meter** - payment accrues to the provider second by second. They may withdraw the earned part at any moment.
- **Stop** - either side closes. Earned to the provider, the remainder to the renter, in one transaction.

There is no arbiter because none is needed: a renter can close at any second and walk away with every unspent cent. A provider who goes dark stops being paid within seconds of being noticed.

The contract does not run, verify or vouch for any machine. A listing is a claim its provider makes. **No owner, no pause, no fee, no upgrade path.**

## Layout

| Path | What |
|---|---|
| `src/ComputeMarket.sol` | The contract. One token (USDG), two arrays (listings, leases), ~240 lines. |
| `test/ComputeMarket.t.sol` | 14 Foundry tests incl. a fuzz over timings that settles every lease to zero. |
| `web/` | Next.js landing, console (`/app`) and docs (`/docs`). |
| `relay/` | A provider process that mirrors Vast.ai machine types onto the shelf and fulfils leases with real instances. |

## Deployed

| Name | Address |
|---|---|
| ComputeMarket | `0xd172e6Aa54e2D04F4168a339B63F284c99162D9d` |
| RNODE (token, 18 dec, 1B supply) | `0x954f81c9bdce955619e8533bc5fdd9d0503cf8b4` |
| USDG | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` |
| Chain | Robinhood Chain, EVM 4663 |

## Run

```sh
# contract
forge test

# web
cd web && npm install && npm run dev

# relay (needs a Vast.ai key, a funded relay key and a public URL - see relay/README.md)
cd relay && cp .env.example .env && npm install && npm start
```

## The mechanism, in one formula

```
earned = min(pricePerHour × (now − startAt) ÷ 3600, funded)
close(): owed = earned − claimed → provider · refund = funded − claimed − owed → renter
```

Price is frozen at `rent()`. A provider repricing the listing cannot touch a live lease. A lease that outruns its funding stops earning; it never goes into debt.

## License

MIT
