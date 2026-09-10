// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {ComputeMarket} from "../src/ComputeMarket.sol";

/// Deploys the marketplace to RH Chain. It takes no owner, so there is nothing
/// to hand over afterwards - what lands on-chain is final.
contract Deploy is Script {
    address constant USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;

    function run() external {
        vm.startBroadcast();
        ComputeMarket market = new ComputeMarket(IERC20(USDG));
        vm.stopBroadcast();
        console.log("NEXT_PUBLIC_MARKET_ADDRESS=%s", address(market));
    }
}
