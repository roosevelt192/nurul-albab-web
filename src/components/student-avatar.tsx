"use client";

import Image from "next/image";
import { useState } from "react";

export function StudentAvatar({
  name,
  src,
  size = "size-11",
}: {
  name: string;
  src: string | null;
  size?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";

  return (
    <span aria-label={`Foto ${name}`} role="img" className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#eef0ff] text-xs font-bold text-[#4457ff] ${size}`}>
      {src && !failed ? (
        <Image src={src} alt="" fill unoptimized sizes="48px" className="object-cover" onError={() => setFailed(true)} />
      ) : initials}
    </span>
  );
}
