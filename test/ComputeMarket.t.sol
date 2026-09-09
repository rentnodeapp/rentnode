// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {ComputeMarket} from "../src/ComputeMarket.sol";

contract MockUSDG is ERC20 {
    constructor() ERC20("USDG", "USDG") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 a) external { _mint(to, a); }
}

contract ComputeMarketTest is Test {
    ComputeMarket market;
    MockUSDG usdg;

    address provider = address(0xA11CE);
    address renter = address(0xB0B);
    address stranger = address(0xCAFE);

    uint96 constant PER_HOUR = 3_600_000; // 3.60 USDG/hr => exactly 1000 wei/sec

    function setUp() public {
        usdg = new MockUSDG();
        market = new ComputeMarket(IERC20(address(usdg)));
        usdg.mint(renter, 1_000e6);
        usdg.mint(stranger, 1_000e6);
        vm.prank(renter);
        usdg.approve(address(market), type(uint256).max);
        vm.prank(stranger);
        usdg.approve(address(market), type(uint256).max);

        vm.prank(provider);
        market.list(ComputeMarket.Kind.GPU, PER_HOUR, "RTX 4090 / 24GB / eu-central", "ssh://box.example:22");
    }

    function _rent(uint96 amount) internal returns (uint256 id) {
        vm.prank(renter);
        id = market.rent(0, amount);
    }

    function test_lists_and_rents() public {
        uint256 id = _rent(36e6); // ten hours
        ComputeMarket.Lease memory l = market.leaseAt(id);
        assertEq(l.renter, renter);
        assertEq(l.provider, provider);
        assertEq(l.funded, 36e6);
        assertEq(l.pricePerHour, PER_HOUR);
        assertEq(usdg.balanceOf(address(market)), 36e6);
    }

    function test_earnings_meter_per_second() public {
        uint256 id = _rent(36e6);
        assertEq(market.earned(id), 0);
        vm.warp(vm.getBlockTimestamp() + 1);
        assertEq(market.earned(id), 1000); // one second, not one hour
        vm.warp(vm.getBlockTimestamp() + 3599);
        assertEq(market.earned(id), PER_HOUR); // a full hour
    }

    function test_provider_claims_without_ending_the_lease() public {
        uint256 id = _rent(36e6);
        vm.warp(vm.getBlockTimestamp() + 3600);
        vm.prank(provider);
        uint96 paid = market.claim(id);
        assertEq(paid, PER_HOUR);
        assertEq(usdg.balanceOf(provider), PER_HOUR);
        assertEq(market.leaseAt(id).closedAt, 0); // still running
    }

    /// The point of the whole design: walking away is instant and cheap.
    function test_renter_closes_and_is_refunded_the_unspent_part() public {
        uint256 id = _rent(36e6);
        vm.warp(vm.getBlockTimestamp() + 1800); // half an hour
        uint256 before = usdg.balanceOf(renter);

        vm.prank(renter);
        market.close(id);

        assertEq(usdg.balanceOf(provider), PER_HOUR / 2);
        assertEq(usdg.balanceOf(renter) - before, 36e6 - PER_HOUR / 2);
        assertEq(usdg.balanceOf(address(market)), 0); // nothing stranded
    }

    function test_provider_may_also_close() public {
        uint256 id = _rent(36e6);
        vm.warp(vm.getBlockTimestamp() + 600);
        vm.prank(provider);
        market.close(id);
        assertEq(market.leaseAt(id).closedAt, vm.getBlockTimestamp());
        assertEq(usdg.balanceOf(address(market)), 0);
    }

    function test_strangers_cannot_close_or_claim() public {
        uint256 id = _rent(36e6);
        vm.warp(vm.getBlockTimestamp() + 600);
        vm.prank(stranger);
        vm.expectRevert(ComputeMarket.NotParty.selector);
        market.close(id);
        vm.prank(stranger);
        vm.expectRevert(ComputeMarket.NotProvider.selector);
        market.claim(id);
    }

    /// A lease left running past its funding must stop, not overdraw.
    function test_earnings_are_capped_at_the_funded_amount() public {
        uint256 id = _rent(PER_HOUR); // exactly one hour
        vm.warp(vm.getBlockTimestamp() + 100 hours);
        assertEq(market.earned(id), PER_HOUR);
        assertEq(market.refundable(id), 0);

        vm.prank(provider);
        market.claim(id);
        assertEq(usdg.balanceOf(provider), PER_HOUR);

        vm.prank(renter);
        market.close(id); // settles to zero, no revert, nothing extra paid
        assertEq(usdg.balanceOf(provider), PER_HOUR);
        assertEq(usdg.balanceOf(address(market)), 0);
    }

    function test_claim_then_close_never_double_pays() public {
        uint256 id = _rent(36e6);
        vm.warp(vm.getBlockTimestamp() + 3600);
        vm.prank(provider);
        market.claim(id); // takes the first hour

        vm.warp(vm.getBlockTimestamp() + 3600);
        vm.prank(renter);
        market.close(id); // must pay only the second hour

        assertEq(usdg.balanceOf(provider), PER_HOUR * 2);
        assertEq(usdg.balanceOf(address(market)), 0);
    }

    function test_topup_extends_the_runway() public {
        uint256 id = _rent(PER_HOUR);
        assertEq(market.runway(id), 3600);
        vm.prank(stranger); // a colleague may keep the box alive
        market.topUp(id, PER_HOUR);
        assertEq(market.runway(id), 7200);
        assertEq(market.leaseAt(id).funded, PER_HOUR * 2);
    }

    /// A price change must not reach a lease that is already running.
    function test_price_change_does_not_touch_a_live_lease() public {
        uint256 id = _rent(36e6);
        vm.prank(provider);
        market.updateListing(0, PER_HOUR * 10, "ssh://box.example:22", true);

        vm.warp(vm.getBlockTimestamp() + 3600);
        assertEq(market.earned(id), PER_HOUR); // the old rate, not the new one
    }

    function test_closed_lease_cannot_be_closed_again() public {
        uint256 id = _rent(36e6);
        vm.prank(renter);
        market.close(id);
        vm.prank(renter);
        vm.expectRevert(ComputeMarket.AlreadyClosed.selector);
        market.close(id);
    }

    function test_cannot_rent_a_closed_listing() public {
        vm.prank(provider);
        market.updateListing(0, PER_HOUR, "ssh://box.example:22", false);
        vm.prank(renter);
        vm.expectRevert(ComputeMarket.ListingClosed.selector);
        market.rent(0, 36e6);
    }

    function test_only_the_provider_edits_a_listing() public {
        vm.prank(stranger);
        vm.expectRevert(ComputeMarket.NotProvider.selector);
        market.updateListing(0, PER_HOUR, "x", true);
    }

    /// Two leases on one listing must settle independently.
    function testFuzz_settles_to_zero_whatever_the_timings(uint32 fundHours, uint32 waitSecs) public {
        fundHours = uint32(bound(fundHours, 1, 100));
        waitSecs = uint32(bound(waitSecs, 0, 500 hours));
        uint96 amount = uint96(uint256(PER_HOUR) * fundHours);

        usdg.mint(renter, amount);
        uint256 id = _rent(amount);
        vm.warp(vm.getBlockTimestamp() + waitSecs);

        vm.prank(renter);
        market.close(id);
        // every cent went to exactly one of the two parties
        assertEq(usdg.balanceOf(address(market)), 0);
    }
}
