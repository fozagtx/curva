"use client";

// Minimal Phantom-style wallet integration (window.phantom.solana / window.solana).

import { useCallback, useEffect, useState } from "react";

export interface SolanaProvider {
  isPhantom?: boolean;
  publicKey: { toBase58(): string } | null;
  connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toBase58(): string } }>;
  disconnect(): Promise<void>;
  signMessage?(message: Uint8Array, encoding: string): Promise<{ signature: Uint8Array }>;
  signAndSendTransaction(tx: unknown): Promise<{ signature: string }>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
}

export function getProvider(): SolanaProvider | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    phantom?: { solana?: SolanaProvider };
    solana?: SolanaProvider;
  };
  return w.phantom?.solana ?? w.solana ?? null;
}

export function useWallet() {
  const [pubkey, setPubkey] = useState<string | null>(null);
  const [available, setAvailable] = useState(false);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    const provider = getProvider();
    if (!provider) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- provider detection on mount
    setAvailable(true);
    provider
      .connect({ onlyIfTrusted: true })
      .then((res) => setPubkey(res.publicKey.toBase58()))
      .catch(() => { /* not yet trusted */ });
    provider.on?.("accountChanged", () => {
      setPubkey(provider.publicKey ? provider.publicKey.toBase58() : null);
    });
    provider.on?.("disconnect", () => setPubkey(null));
  }, []);

  const connect = useCallback(async () => {
    const provider = getProvider();
    if (!provider) {
      window.open("https://phantom.app", "_blank");
      return;
    }
    setConnecting(true);
    try {
      const res = await provider.connect();
      setPubkey(res.publicKey.toBase58());
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    const provider = getProvider();
    await provider?.disconnect();
    setPubkey(null);
  }, []);

  return { pubkey, available, connecting, connect, disconnect };
}

export function shortAddress(addr: string): string {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}
