import Link from "next/link";

const links = [
  { label: "Kasir Quick POS", href: "/koperasi" },
  { label: "Manajemen stok", href: "/koperasi/stok" },
  { label: "Laporan SHU", href: "/koperasi/laporan" },
];

export function CooperativeNav({ active }: { active: (typeof links)[number]["href"] }) {
  return (
    <nav aria-label="Navigasi koperasi" className="flex flex-wrap gap-2">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={active === link.href ? "page" : undefined}
          className={`inline-flex min-h-11 items-center rounded-full px-4 text-xs font-semibold transition ${
            active === link.href
              ? "bg-[#dbeafe] text-[#4457ff]"
              : "text-[#757693] hover:bg-white hover:text-[#181c31]"
          }`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
