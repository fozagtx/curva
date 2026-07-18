"use client";

import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useWallet, shortAddress } from "@/lib/wallet";

export default function WalletButton() {
  const { pubkey, connecting, connect, disconnect } = useWallet();

  if (pubkey) {
    return (
      <Dropdown placement="bottom-end">
        <DropdownTrigger>
          <Button
            radius="full"
            size="sm"
            startContent={<Icon icon="solar:wallet-linear" width={16} />}
            variant="bordered"
          >
            <span className="font-mono text-tiny">{shortAddress(pubkey)}</span>
          </Button>
        </DropdownTrigger>
        <DropdownMenu aria-label="Wallet actions">
          <DropdownItem
            key="disconnect"
            startContent={<Icon icon="solar:logout-2-linear" width={16} />}
            onPress={() => disconnect()}
          >
            Disconnect
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>
    );
  }

  return (
    <Button
      color="primary"
      isLoading={connecting}
      radius="full"
      size="sm"
      startContent={connecting ? undefined : <Icon icon="solar:wallet-bold" width={16} />}
      onPress={() => connect()}
    >
      Connect wallet
    </Button>
  );
}
