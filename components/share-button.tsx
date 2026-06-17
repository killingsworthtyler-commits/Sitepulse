"use client";

import { useState } from "react";

/** Shares the current page URL — copy to clipboard or open the user's email
    client (mailto). We never send mail on the user's behalf. */
export function ShareButton({ subject }: { subject: string }) {
  const [copied, setCopied] = useState(false);

  const url = () => (typeof window !== "undefined" ? window.location.href : "");

  function copy() {
    navigator.clipboard?.writeText(url()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }

  function email() {
    const body = `Site report from SITE PULSE:\n\n${url()}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={copy}
        className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
      >
        {copied ? "Link copied ✓" : "Copy link"}
      </button>
      <button
        onClick={email}
        className="brand-gradient rounded-md px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95"
      >
        ✉ Email report
      </button>
    </div>
  );
}
