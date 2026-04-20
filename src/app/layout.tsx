import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ThemeProvider } from "@/components/layout/ThemeProvider";

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
  title: "Moka | AI Marketing Director",
  description: "AI-powered Marketing Director for high-earning content creators.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Prevent flash of wrong theme on load. Light is the default — add `.dark` only if explicitly stored. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('arko-theme');if(t==='dark'){document.documentElement.classList.add('dark')}else{document.documentElement.classList.remove('dark')}}catch(e){}})();`,
          }}
        />
      </head>
      <body suppressHydrationWarning className={`${manropeLight.className} ${manropeLight.variable} ${manropeBold.variable} antialiased`}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
