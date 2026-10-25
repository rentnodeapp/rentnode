// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {ComputeMarket} from "../src/ComputeMarket.sol";
import {MockUSDG} from "./ComputeMarket.t.sol";

abstract contract TopUpBase is Test {
    ComputeMarket market;
    MockUSDG usdg;
    address provider = address(0xA11CE);
    address renter = address(0xB0B);
    uint96 constant PER_HOUR = 3_600_000;

    function setUp() public {
        usdg = new MockUSDG();
        market = new ComputeMarket(IERC20(address(usdg)));
        usdg.mint(renter, 1_000e6);
        vm.prank(renter);
        usdg.approve(address(market), type(uint256).max);
        vm.prank(provider);
        market.list(ComputeMarket.Kind.GPU, PER_HOUR, "RTX 4090", "ssh://box.example:22");
    }
}

contract TopUpAfterRunOutTest is TopUpBase {
    /// One funded hour, then the lease sits unfunded for 10 hours. The renter adds
    /// 5 hours. Docs: a lease that runs out "simply stops earning ... the renter is
    /// never billed past what they escrowed". The 5 new hours should be runway.
    function test_topup_after_running_out_buys_runway_not_arrears() public {
        vm.prank(renter);
        uint256 id = market.rent(0, PER_HOUR);
        vm.warp(block.timestamp + 11 hours);
        assertEq(market.runway(id), 0);

        vm.prank(renter);
        market.topUp(id, 5 * PER_HOUR);

        assertEq(market.runway(id), 5 hours, "the top-up bought no runway");
        assertEq(market.earned(id), PER_HOUR, "the unfunded hours were billed");
    }
}

contract TopUpAfterRunOutSettleTest is TopUpBase {
    function test_claimed_then_dry_then_topup_then_close_settles_to_zero() public {
        vm.prank(renter);
        uint256 id = market.rent(0, 7_777_777);
        vm.warp(block.timestamp + 13 hours + 17);
        vm.prank(provider);
        market.claim(id);
        vm.prank(renter);
        market.topUp(id, 1_234_567);
        vm.warp(block.timestamp + 5 minutes);
        vm.prank(provider);
        market.claim(id);
        vm.prank(renter);
        market.close(id);
        assertEq(usdg.balanceOf(address(market)), 0);
    }
}

contract TopUpAfterRunOutFuzz is TopUpBase {
    function testFuzz_dry_topup_settles(uint64 fund, uint32 w1, uint64 add, uint32 w2, uint96 price) public {
        price = uint96(bound(price, 1, 1e9));
        fund = uint64(bound(fund, 1, 400e6));
        add = uint64(bound(add, 1, 400e6));
        vm.prank(provider);
        market.list(ComputeMarket.Kind.GPU, price, "x", "y");
        vm.prank(renter);
        uint256 id = market.rent(1, uint96(fund));
        vm.warp(block.timestamp + w1);
        vm.prank(provider);
        try market.claim(id) {} catch {}
        vm.prank(renter);
        market.topUp(id, uint96(add));
        assertLe(market.earned(id), market.leaseAt(id).funded);
        assertGe(market.earned(id), market.leaseAt(id).claimed);
        vm.warp(block.timestamp + w2);
        vm.prank(provider);
        try market.claim(id) {} catch {}
        vm.prank(renter);
        market.close(id);
        assertEq(usdg.balanceOf(address(market)), 0);
    }
}
