import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { DraftCleanup } from "@/components/loan/DraftCleanup";
import { routing } from "@/i18n/routing";
import "./globals.css";

// Inter ships a Vietnamese subset, so diacritics render correctly.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "vietnamese"],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");
  return { title: t("title"), description: t("description") };
}

export default async function LocaleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider>
          <DraftCleanup />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
