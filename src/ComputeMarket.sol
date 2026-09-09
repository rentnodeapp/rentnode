// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

/**
 * A settlement rail for rented infrastructure - GPUs, CPUs, storage, databases.
 *
 * What this contract does and does not do matters, because the difference is
 * where people get hurt. It escrows money and meters it out per second. It does
 * NOT run, verify, or vouch for any machine: the hardware lives off-chain and
 * this contract has no way to see it. A listing is a claim its provider makes,
 * not a fact the chain checked.
 *
 * That would normally demand an arbiter to settle "the box was down" disputes,
 * and an arbiter is a person who can be captured. This avoids needing one: the
 * renter can close a lease at any second and walk away with every unspent cent.
 * A provider who goes dark stops being paid within seconds of being noticed, so
 * the worst outcome is small enough that nobody needs a judge. That is the
 * whole design - everything else here is bookkeeping.
 *
 * No owner, no pause, no fee, no upgrade path. What deploys is what runs.
 */
contract ComputeMarket is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// What is being rented. Free text describes it; this only sorts the shelf.
    enum Kind { GPU, CPU, Storage, Database }

    struct Listing {
        address provider;
        Kind kind;
        /// USDG per hour, 6 decimals. Rates are metered per second from this.
        uint96 pricePerHour;
        bool open;
        /// "RTX 4090 / 24GB VRAM / 64GB RAM / eu-central". Meaning is off-chain.
        string spec;
        /// Where the renter reaches it once paid. The provider keeps it current.
        string endpoint;
    }

    struct Lease {
        uint64 listingId;
        address renter;
        address provider;
        /// Frozen at rent() so a later price change cannot touch a live lease.
        uint96 pricePerHour;
        uint96 funded;
        uint96 claimed;
        uint64 startAt;
        /// 0 while running; the settle-through timestamp once closed.
        uint64 closedAt;
    }

    IERC20 public immutable usdg;

    Listing[] private _listings;
    Lease[] private _leases;

    mapping(address => uint256[]) private _byProvider;
    mapping(address => uint256[]) private _byRenter;

    event Listed(uint256 indexed id, address indexed provider, Kind kind, uint96 pricePerHour);
    event ListingUpdated(uint256 indexed id, uint96 pricePerHour, bool open);
    event Rented(uint256 indexed leaseId, uint256 indexed listingId, address indexed renter, uint96 funded, uint96 pricePerHour);
    event ToppedUp(uint256 indexed leaseId, uint96 added);
    event Claimed(uint256 indexed leaseId, address indexed provider, uint96 amount);
    event Closed(uint256 indexed leaseId, address indexed by, uint96 toProvider, uint96 refunded);

    error NotProvider();
    error NotParty();
    error ListingClosed();
    error BadPrice();
    error BadAmount();
    error AlreadyClosed();
    error NoListing();
    error NoLease();

    constructor(IERC20 usdg_) {
        usdg = usdg_;
    }

    // ------------------------------------------------------------------ list

    /// Anyone may list. Reputation is the on-chain lease history, not a deposit:
    /// a deposit only gates entry unless someone can judge when to seize it.
    function list(Kind kind, uint96 pricePerHour, string calldata spec, string calldata endpoint)
        external
        returns (uint256 id)
    {
        if (pricePerHour == 0) revert BadPrice();
        id = _listings.length;
        _listings.push(Listing({
            provider: msg.sender,
            kind: kind,
            pricePerHour: pricePerHour,
            open: true,
            spec: spec,
            endpoint: endpoint
        }));
        _byProvider[msg.sender].push(id);
        emit Listed(id, msg.sender, kind, pricePerHour);
    }

    /// Price changes bind only future leases; live ones keep the rate they
    /// started at, so nobody's bill can be raised mid-flight.
    function updateListing(uint256 id, uint96 pricePerHour, string calldata endpoint, bool open) external {
        if (id >= _listings.length) revert NoListing();
        Listing storage l = _listings[id];
        if (l.provider != msg.sender) revert NotProvider();
        if (pricePerHour == 0) revert BadPrice();
        l.pricePerHour = pricePerHour;
        l.endpoint = endpoint;
        l.open = open;
        emit ListingUpdated(id, pricePerHour, open);
    }

    // ----------------------------------------------------------------- rent

    /// Escrow `amount` USDG against a listing. The clock starts immediately.
    function rent(uint256 listingId, uint96 amount) external nonReentrant returns (uint256 leaseId) {
        if (listingId >= _listings.length) revert NoListing();
        Listing storage l = _listings[listingId];
        if (!l.open) revert ListingClosed();
        if (amount == 0) revert BadAmount();

        usdg.safeTransferFrom(msg.sender, address(this), amount);

        leaseId = _leases.length;
        _leases.push(Lease({
            listingId: uint64(listingId),
            renter: msg.sender,
            provider: l.provider,
            pricePerHour: l.pricePerHour,
            funded: amount,
            claimed: 0,
            startAt: uint64(block.timestamp),
            closedAt: 0
        }));
        _byRenter[msg.sender].push(leaseId);
        emit Rented(leaseId, listingId, msg.sender, amount, l.pricePerHour);
    }

    /// Add more hours to a running lease. Anyone may pay - a team can keep a
    /// colleague's box alive - but only the renter is ever refunded.
    function topUp(uint256 leaseId, uint96 amount) external nonReentrant {
        Lease storage ls = _leaseAt(leaseId);
        if (ls.closedAt != 0) revert AlreadyClosed();
        if (amount == 0) revert BadAmount();
        usdg.safeTransferFrom(msg.sender, address(this), amount);
        ls.funded += amount;
        emit ToppedUp(leaseId, amount);
    }

    /// Draw down what the lease has earned so far. Providers can call this
    /// whenever; nothing forces them to wait for the lease to end.
    function claim(uint256 leaseId) external nonReentrant returns (uint96 paid) {
        Lease storage ls = _leaseAt(leaseId);
        if (ls.provider != msg.sender) revert NotProvider();
        paid = _earned(ls) - ls.claimed;
        if (paid == 0) revert BadAmount();
        ls.claimed += paid;
        usdg.safeTransfer(ls.provider, paid);
        emit Claimed(leaseId, ls.provider, paid);
    }

    /// End a lease. Either side may call: the renter to stop paying for a box
    /// that stopped working, the provider to take the machine back. Settlement
    /// is the same either way - earned to the provider, the rest to the renter.
    function close(uint256 leaseId) external nonReentrant {
        Lease storage ls = _leaseAt(leaseId);
        if (msg.sender != ls.renter && msg.sender != ls.provider) revert NotParty();
        if (ls.closedAt != 0) revert AlreadyClosed();

        ls.closedAt = uint64(block.timestamp);

        uint96 owed = _earned(ls) - ls.claimed;
        uint96 refund = ls.funded - ls.claimed - owed;
        ls.claimed += owed;

        if (owed > 0) usdg.safeTransfer(ls.provider, owed);
        if (refund > 0) usdg.safeTransfer(ls.renter, refund);
        emit Closed(leaseId, msg.sender, owed, refund);
    }

    // ----------------------------------------------------------------- views

    /// USDG the lease has earned the provider, capped at what was funded. A
    /// lease that runs past its funding simply stops earning - it does not go
    /// into debt, and the renter is never billed for more than they escrowed.
    function earned(uint256 leaseId) external view returns (uint96) {
        return _earned(_leaseAt(leaseId));
    }

    /// What the renter gets back if the lease closed this second.
    function refundable(uint256 leaseId) external view returns (uint96) {
        Lease storage ls = _leaseAt(leaseId);
        return ls.funded - _earned(ls);
    }

    /// Seconds of runway left at the current rate; 0 once the funding is spent.
    function runway(uint256 leaseId) external view returns (uint64) {
        Lease storage ls = _leaseAt(leaseId);
        if (ls.closedAt != 0) return 0;
        uint256 left = ls.funded - _earned(ls);
        return uint64((left * 3600) / ls.pricePerHour);
    }

    function listingCount() external view returns (uint256) { return _listings.length; }
    function leaseCount() external view returns (uint256) { return _leases.length; }
    function listingAt(uint256 id) external view returns (Listing memory) {
        if (id >= _listings.length) revert NoListing();
        return _listings[id];
    }
    function leaseAt(uint256 id) external view returns (Lease memory) { return _leaseAt(id); }
    function listingsOf(address provider) external view returns (uint256[] memory) { return _byProvider[provider]; }
    function leasesOf(address renter) external view returns (uint256[] memory) { return _byRenter[renter]; }

    // -------------------------------------------------------------- internal

    function _leaseAt(uint256 id) private view returns (Lease storage) {
        if (id >= _leases.length) revert NoLease();
        return _leases[id];
    }

    /// Metered per second off the hourly price. Multiplying before dividing
    /// keeps sub-cent seconds from rounding away to nothing over a long lease.
    function _earned(Lease storage ls) private view returns (uint96) {
        uint64 until = ls.closedAt == 0 ? uint64(block.timestamp) : ls.closedAt;
        uint256 elapsed = until - ls.startAt;
        uint256 e = (uint256(ls.pricePerHour) * elapsed) / 3600;
        return e >= ls.funded ? ls.funded : uint96(e);
    }
}
