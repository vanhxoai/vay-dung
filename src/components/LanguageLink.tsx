"use client";

import { useLocale } from "next-intl";
import { getPathname } from "@/i18n/navigation";

/**
 * Switches language with a full page load. A client-side switch keeps the old-language
 * page hidden in the document, including whatever the user typed there.
 */
export function LanguageLink({
  href,
  onClick,
  className,
  children,
}: {
  href: "/" | "/vay" | "/kiem-tra" | "/rieng-tu";
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const otherLocale = useLocale() === "vi" ? "en" : "vi";
  return (
    <a href={getPathname({ href, locale: otherLocale })} onClick={onClick} className={className}>
      {children}
    </a>
  );
}
