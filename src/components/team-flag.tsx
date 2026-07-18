"use client";

import { useState } from "react";
import { teamFlagUrl, teamInitials } from "@/lib/team-flag";

export default function TeamFlag({
  name,
  size = 28,
  className = "",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const url = teamFlagUrl(name, size >= 40 ? 80 : 40);
  const [failed, setFailed] = useState(false);

  if (!url || failed) {
    return (
      <span
        aria-hidden
        className={`inline-flex shrink-0 items-center justify-center rounded-full border border-default-200 bg-default-100 text-[9px] font-bold text-default-600 ${className}`}
        style={{ width: size, height: size }}
        title={name}
      >
        {teamInitials(name)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt=""
      className={`shrink-0 rounded-sm object-cover shadow-sm ${className}`}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      src={url}
      style={{ width: size, height: Math.round(size * 0.75), objectFit: "cover" }}
      title={name}
      width={size}
    />
  );
}
