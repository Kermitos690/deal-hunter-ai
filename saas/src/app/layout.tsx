import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Deal Hunter AI",
  description: "Radars privés d’opportunités et micro-arbitrage."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="fr"><body>{children}</body></html>;
}
