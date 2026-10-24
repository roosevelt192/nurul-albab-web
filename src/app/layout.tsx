import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Nurul Albab — Ilmu, Adab, dan Khidmah",
    template: "%s | Nurul Albab",
  },
  description:
    "Pondok Pesantren Nurul Albab mendampingi santri belajar, menghafal, dan bertumbuh dalam lingkungan yang hangat dan berlandaskan adab.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
