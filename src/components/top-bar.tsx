"use client";

import Link from "next/link";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import WalletButton from "./wallet-button";
import KryvaMark from "./kryva-mark";

export default function TopBar({ backHref }: { backHref?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-large border-small border-default-200 bg-content1 px-4 py-3 shadow-small">
      <div className="flex items-center gap-3">
        {backHref ? (
          <Button
            as={Link}
            href={backHref}
            isIconOnly
            aria-label="Back to matches"
            radius="full"
            size="sm"
            variant="light"
          >
            <Icon icon="solar:alt-arrow-left-linear" width={18} />
          </Button>
        ) : null}
        <Link className="flex items-center gap-2.5" href="/">
          <div className="flex items-center rounded-medium border border-primary-100 bg-primary-50 p-2">
            <KryvaMark size={22} />
          </div>
          <p className="text-medium font-semibold">Kryva</p>
        </Link>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <Button
          as={Link}
          href="/hub"
          radius="full"
          size="sm"
          startContent={<Icon icon="solar:user-rounded-bold-duotone" width={16} />}
          variant="flat"
        >
          Hub
        </Button>
        <WalletButton />
      </div>
    </div>
  );
}
