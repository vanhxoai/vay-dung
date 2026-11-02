"use client";

import { Analytics } from "@vercel/analytics/next";

/** Cookieless, aggregate page views. Query strings are removed before anything is sent. */
export function SiteAnalytics() {
  return <Analytics beforeSend={(event) => ({ ...event, url: event.url.split("?")[0] })} />;
}
