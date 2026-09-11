"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { createWalletClient, custom, type Address, type EIP1193Provider } from "viem";
import { robinhoodChain } from "../src/chain.ts";

export interface Wallet {
  address: Address | null;
  chainOk: boolean;
  busy: boolean;
  /** No Privy id and no browser wallet: connecting is impossible, say so. */
  unavailable: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  send: (tx: { to: Address; data: `0x${string}`; value?: bigint }) => Promise<`0x${string}`>;
}

const CHAIN_CAIP = `eip155:${robinhoodChain.id}`;
const CHAIN_HEX = `0x${robinhoodChain.id.toString(16)}`;

/** The chain object routes reads through /api/rpc, which is ours and correct
 *  for the app but meaningless to somebody else's wallet. A wallet needs a URL
 *  it can reach itself. */
const PUBLIC_RPC = "https://rpc.mainnet.chain.robinhood.com";

const HAS_PRIVY = /^[a-z0-9]{20,32}$/i.test((process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "").trim());

/**
 * Which wallet path the app uses is decided by a build-time environment
 * variable, so the value never changes between renders and the hook order
 * stays stable. This reads like a conditional hook and is not one.
 */
export function useWallet(): Wallet {
  return HAS_PRIVY ? usePrivyWallet() : useInjectedWallet();
}

// ------------------------------------------------------------------ injected

type Injected = EIP1193Provider & {
  on?: (e: string, h: (...a: never[]) => void) => void;
  removeListener?: (e: string, h: (...a: never[]) => void) => void;
};

const injected = (): Injected | null =>
  typeof window === "undefined" ? null : ((window as unknown as { ethereum?: Injected }).ethereum ?? null);

/** MetaMask, Rabby, Frame - anything that speaks EIP-1193 in the page. */
function useInjectedWallet(): Wallet {
  const [address, setAddress] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const p = injected();
    if (!p) { setChecked(true); return; }

    // eth_accounts returns the already-authorised account without prompting, so
    // a returning visitor is connected before they touch anything.
    void (async () => {
      try {
        const a = (await p.request({ method: "eth_accounts" })) as Address[];
        if (a?.[0]) setAddress(a[0]);
        setChainId((await p.request({ method: "eth_chainId" })) as string);
      } catch { /* a locked wallet simply answers nothing */ }
      setChecked(true);
    })();

    const onAccounts = (...a: never[]) => setAddress(((a[0] as unknown as Address[])?.[0]) ?? null);
    const onChain = (...a: never[]) => setChainId(a[0] as unknown as string);
    p.on?.("accountsChanged", onAccounts);
    p.on?.("chainChanged", onChain);
    return () => {
      p.removeListener?.("accountsChanged", onAccounts);
      p.removeListener?.("chainChanged", onChain);
    };
  }, []);

  const chainOk = chainId != null && Number.parseInt(chainId, 16) === robinhoodChain.id;

  const toChain = useCallback(async (p: Injected) => {
    try {
      await p.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_HEX }] } as never);
    } catch (e) {
      // 4902: the wallet has never heard of this network. Offer to add it
      // rather than leaving the user to type chain parameters by hand.
      if ((e as { code?: number })?.code !== 4902) throw e;
      await p.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: CHAIN_HEX,
          chainName: robinhoodChain.name,
          nativeCurrency: robinhoodChain.nativeCurrency,
          rpcUrls: [PUBLIC_RPC],
          blockExplorerUrls: [robinhoodChain.blockExplorers?.default.url],
        }],
      } as never);
    }
  }, []);

  const connect = useCallback(async () => {
    const p = injected();
    setError(null);
    if (!p) { setError("No browser wallet found. Install MetaMask or Rabby, then reload."); return; }
    setBusy(true);
    try {
      const a = (await p.request({ method: "eth_requestAccounts" })) as Address[];
      setAddress(a?.[0] ?? null);
      await toChain(p);
      setChainId((await p.request({ method: "eth_chainId" })) as string);
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }, [toChain]);

  // An injected wallet has no logout; forgetting the address is all a page can
  // honestly do, and the extension still decides what it shares next time.
  const disconnect = useCallback(() => { setAddress(null); setError(null); }, []);

  const send = useCallback(async (tx: { to: Address; data: `0x${string}`; value?: bigint }) => {
    const p = injected();
    if (!p || !address) throw new Error("Connect a wallet first");
    // Prove the network before asking for a signature: signing on the wrong
    // chain produces a transaction that can never land here.
    if (!chainOk) await toChain(p);
    const client = createWalletClient({ account: address, chain: robinhoodChain, transport: custom(p) });
    return client.sendTransaction({ to: tx.to, data: tx.data, value: tx.value ?? 0n });
  }, [address, chainOk, toChain]);

  return useMemo(() => ({
    address, chainOk, busy, error,
    unavailable: checked && !injected(),
    connect, disconnect, send,
  }), [address, chainOk, busy, error, checked, connect, disconnect, send]);
}

// --------------------------------------------------------------------- privy

function usePrivyWallet(): Wallet {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const [error, setError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  const wallet = wallets[0] ?? null;
  const address = (wallet?.address as Address | undefined) ?? null;
  const chainOk = wallet?.chainId === CHAIN_CAIP;

  useEffect(() => {
    if (!wallet || chainOk || switching) return;
    setSwitching(true);
    void wallet.switchChain(robinhoodChain.id)
      .catch((e: unknown) => setError(friendly(e)))
      .finally(() => setSwitching(false));
  }, [wallet, chainOk, switching]);

  const connect = useCallback(async () => {
    setError(null);
    try {
      if (!authenticated) { login(); return; }
      if (wallet && !chainOk) await wallet.switchChain(robinhoodChain.id);
    } catch (e) { setError(friendly(e)); }
  }, [authenticated, login, wallet, chainOk]);

  const disconnect = useCallback(() => { setError(null); void logout(); }, [logout]);

  const send = useCallback(async (tx: { to: Address; data: `0x${string}`; value?: bigint }) => {
    if (!wallet || !address) throw new Error("Connect a wallet first");
    if (wallet.chainId !== CHAIN_CAIP) await wallet.switchChain(robinhoodChain.id);
    const provider = await wallet.getEthereumProvider();
    const client = createWalletClient({ account: address, chain: robinhoodChain, transport: custom(provider) });
    return client.sendTransaction({ to: tx.to, data: tx.data, value: tx.value ?? 0n });
  }, [wallet, address]);

  return useMemo(() => ({
    address, chainOk, busy: !ready || switching, unavailable: false, error, connect, disconnect, send,
  }), [address, chainOk, ready, switching, error, connect, disconnect, send]);
}

/** Wallet errors arrive as provider dumps; turn the common ones into English. */
export function friendly(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  const code = (e as { code?: number })?.code;

  if (code === 4001 || /user rejected|denied|cancell?ed/i.test(raw)) return "You cancelled the signature.";
  if (/insufficient funds/i.test(raw)) return "Not enough ETH to cover gas.";
  if (/transfer amount exceeds balance|exceeds balance/i.test(raw)) return "Not enough balance for that amount.";
  if (/gas required exceeds|intrinsic gas/i.test(raw)) return "Gas estimate failed — the transaction would revert.";
  if (/nonce/i.test(raw)) return "A previous transaction is still pending.";
  if (/chain|network/i.test(raw) && /mismatch|unsupported|switch/i.test(raw)) return "Switch your wallet to RH Chain.";
  if (/fetch|network error|failed to fetch/i.test(raw)) return "Couldn't reach the network — check your connection.";

  return raw.split("\n")[0].slice(0, 160);
}
