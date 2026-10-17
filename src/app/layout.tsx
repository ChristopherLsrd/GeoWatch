import "./globals.css";
import { Bricolage_Grotesque, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import { AppHeader } from "./components/AppHeader";

const display = Bricolage_Grotesque({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});
const body = Instrument_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

// Drapeaux des pays (Twemoji, CC-BY 4.0) : Windows n'a pas d'emoji de drapeaux et affiche
// les deux lettres du code ISO. La plage Unicode limite la police aux indicateurs régionaux.
const flags = localFont({
  src: "./fonts/TwemojiCountryFlags.woff2",
  variable: "--font-flags",
  display: "swap",
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+1F1E6-1F1FF" }],
});

export const metadata = { title: "GeoWatch" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${display.variable} ${body.variable} ${mono.variable} ${flags.variable}`}>
      <body>
        <AppHeader />
        {children}
      </body>
    </html>
  );
}
