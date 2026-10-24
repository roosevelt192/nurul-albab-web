"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/icon";
import { navigationItems } from "@/lib/navigation";
import { createClient } from "@/lib/supabase/client";

type PaletteGroup = "Navigasi" | "Santri" | "Produk";

type PaletteItem = {
  id: string;
  group: PaletteGroup;
  label: string;
  sublabel: string;
  href: string;
  icon: IconName;
  search: string;
};

const groupOrder: PaletteGroup[] = ["Navigasi", "Santri", "Produk"];

function normalize(value: unknown): string {
  return String(value ?? "").toLowerCase();
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [students, setStudents] = useState<PaletteItem[]>([]);
  const [products, setProducts] = useState<PaletteItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      setQuery("");
      setActiveIndex(0);
      inputRef.current?.focus();
    }, 30);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (loadedRef.current) return;
    loadedRef.current = true;
    let active = true;

    async function loadPaletteData() {
      setIsLoading(true);
      const supabase = createClient();
      const [studentResult, productResult] = await Promise.all([
        supabase.from("santri").select("id, nis, nama_lengkap, status").neq("status", "pending_ppdb").limit(400),
        supabase.from("produk_koperasi").select("*").eq("is_active", true).limit(400),
      ]);

      if (!active) return;

      if (!studentResult.error) {
        setStudents(
          (studentResult.data ?? []).map((student) => ({
            id: `santri-${student.id}`,
            group: "Santri" as const,
            label: student.nama_lengkap,
            sublabel: student.nis ? `NIS ${student.nis}` : "NIS belum tersedia",
            href: `/santri?q=${encodeURIComponent(student.nama_lengkap)}`,
            icon: "users" as IconName,
            search: `${student.nama_lengkap} ${student.nis ?? ""}`,
          })),
        );
      }

      if (!productResult.error) {
        setProducts(
          ((productResult.data ?? []) as Array<Record<string, unknown>>).map((product) => {
            const name = String(product.name ?? product.nama_produk ?? "Produk koperasi");
            const barcode = String(product.barcode ?? "");
            const sku = String(product.sku ?? product.kode_barang ?? "");
            const stock = Number(product.stock ?? product.stok ?? 0);
            return {
              id: `produk-${String(product.id ?? name)}`,
              group: "Produk" as const,
              label: name,
              sublabel: `${barcode || sku || "Tanpa barcode"} · stok ${stock}`,
              href: "/koperasi/stok",
              icon: "store" as IconName,
              search: `${name} ${barcode} ${sku}`,
            };
          }),
        );
      }

      setIsLoading(false);
    }

    void loadPaletteData().catch(() => setIsLoading(false));
    return () => {
      active = false;
    };
  }, [open]);

  const navigationResults = useMemo<PaletteItem[]>(
    () =>
      navigationItems.map((item) => ({
        id: `nav-${item.href}`,
        group: "Navigasi" as const,
        label: item.label,
        sublabel: item.description,
        href: item.href,
        icon: item.icon,
        search: `${item.label} ${item.description}`,
      })),
    [],
  );

  const grouped = useMemo(() => {
    const needle = normalize(query).trim();
    const match = (item: PaletteItem) => !needle || normalize(item.search).includes(needle);
    return {
      Navigasi: navigationResults.filter(match).slice(0, 6),
      Santri: students.filter(match).slice(0, 6),
      Produk: products.filter(match).slice(0, 6),
    } as Record<PaletteGroup, PaletteItem[]>;
  }, [navigationResults, products, query, students]);

  const flatItems = useMemo(
    () => groupOrder.flatMap((group) => grouped[group]),
    [grouped],
  );

  function select(item: PaletteItem) {
    onClose();
    router.push(item.href);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (flatItems.length ? (current + 1) % flatItems.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (flatItems.length ? (current - 1 + flatItems.length) % flatItems.length : 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = flatItems[activeIndex];
      if (item) select(item);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  }

  useEffect(() => {
    if (!open) return;
    const active = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center bg-[#181c31]/40 px-3 pt-[12vh] backdrop-blur-sm sm:px-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Pencarian cepat"
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.28)]"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-slate-100 px-4">
          <Icon name="search" size={18} className="shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            placeholder="Cari santri, produk, atau menu…"
            className="h-14 w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
          />
          <kbd className="hidden shrink-0 rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 sm:block">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[min(60vh,420px)] overflow-y-auto px-2 py-2 [scrollbar-width:thin]">
          {isLoading && <p className="px-3 py-4 text-xs text-slate-400">Memuat data santri dan produk…</p>}

          {!isLoading &&
            groupOrder.map((group) => {
              const items = grouped[group];
              if (!items.length) return null;
              return (
                <div key={group} className="mb-1">
                  <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    {group}
                  </p>
                  {items.map((item) => {
                    const index = flatItems.findIndex((entry) => entry.id === item.id);
                    const isActive = index === activeIndex;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        data-index={index}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => select(item)}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                          isActive ? "bg-slate-100" : "hover:bg-slate-50"
                        }`}
                      >
                        <span
                          className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
                            group === "Santri"
                              ? "bg-[#eef0ff] text-[#4457ff]"
                              : group === "Produk"
                                ? "bg-[#e8f5f0] text-[#25815e]"
                                : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          <Icon name={item.icon} size={15} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-800">{item.label}</span>
                          <span className="block truncate text-[11px] text-slate-400">{item.sublabel}</span>
                        </span>
                        {isActive && <Icon name="arrow-right" size={14} className="shrink-0 text-slate-400" />}
                      </button>
                    );
                  })}
                </div>
              );
            })}

          {!isLoading && !flatItems.length && (
            <div className="px-3 py-10 text-center">
              <p className="text-sm font-semibold text-slate-700">Tidak ada hasil</p>
              <p className="mt-1 text-xs text-slate-400">Coba kata kunci lain atau periksa ejaan.</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-2.5 text-[10px] text-slate-400">
          <span className="flex items-center gap-2">
            <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5">↑</kbd>
            <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5">↓</kbd>
            navigasi
          </span>
          <span className="flex items-center gap-2">
            <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5">Enter</kbd>
            buka
            <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5">Esc</kbd>
            tutup
          </span>
        </div>
      </section>
    </div>
  );
}
