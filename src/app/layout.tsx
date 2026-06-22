import type { Metadata } from "next";
import localFont from "next/font/local";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
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
  title: "Moka",
  description: "AI-powered Marketing Director for high-earning content creators.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* Prevent flash of wrong theme on load. Light is the default — add `.dark` only if explicitly stored. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('arko-theme');if(t==='dark'){document.documentElement.classList.add('dark')}else{document.documentElement.classList.remove('dark')}}catch(e){}})();`,
          }}
        />
      </head>
      <body suppressHydrationWarning className={`${manropeLight.className} ${manropeLight.variable} ${manropeBold.variable} antialiased`}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
