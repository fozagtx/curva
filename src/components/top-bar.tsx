"use client";

import Link from "next/link";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import WalletButton from "./wallet-button";

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
        <Link className="flex items-center gap-3" href="/">
          <div className="flex items-center rounded-medium border border-primary-100 bg-primary-50 p-2">
            <Icon className="text-primary" icon="solar:pulse-2-bold-duotone" width={22} />
          </div>
          <div className="flex flex-col leading-tight">
            <p className="text-medium font-semibold">Pulse</p>
            <p className="text-tiny text-default-400">Feel the World Cup</p>
          </div>
        </Link>
      </div>
      <WalletButton />
    </div>
  );
}
