import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Nurul Albab — Ilmu, Adab, dan Khidmah",
    template: "%s | Nurul Albab",
  },
  description:
    "Pondok Pesantren Nurul Albab mendampingi santri belajar, menghafal, dan bertumbuh dalam lingkungan yang hangat dan berlandaskan adab.",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="id" className="scroll-smooth">
      <body className="min-h-screen bg-[#f3f5ff] text-[#181c31] antialiased">
        {children}
      </body>
    </html>
  );
}