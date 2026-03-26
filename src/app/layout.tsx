import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const manropeBold = localFont({
  src: "../../public/fonts/manrope.bold.otf",
  variable: "--font-heading-local",
  display: "swap",
});

const manropeLight = localFont({
  src: "../../public/fonts/manrope.light.otf",
  variable: "--font-body-local",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Arko | AI Marketing Director",
  description: "AI-powered Marketing Director for high-earning content creators.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body suppressHydrationWarning className={`${manropeLight.className} ${manropeLight.variable} ${manropeBold.variable} antialiased bg-black text-white`}>
        {children}
      </body>
    </html>
  );
}
