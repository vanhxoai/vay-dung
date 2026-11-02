"use client";

import { useEffect } from "react";
import { clearExpiredDraft } from "./draft";

/** On every page: removes a leftover temporary copy of the user's answers. */
export function DraftCleanup() {
  useEffect(() => {
    clearExpiredDraft();
  }, []);
  return null;
}
