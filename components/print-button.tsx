"use client";

/** Opens the browser print dialog (which offers "Save as PDF"). */
export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
    >
      🖨 Print / PDF
    </button>
  );
}
