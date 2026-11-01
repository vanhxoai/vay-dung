import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["vi", "en"],
  defaultLocale: "vi",
  // Vietnamese lives at "/", English at "/en".
  localePrefix: "as-needed",
  // "/" is always Vietnamese, whatever the browser language. Users switch with the button.
  localeDetection: false,
});
