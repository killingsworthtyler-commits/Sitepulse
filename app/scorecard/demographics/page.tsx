import { ScorecardTabs } from "@/components/scorecard-tabs";
import { DemographicsReportTool } from "@/components/demographics-report";

export const metadata = {
  title: "Demographics — SITE PULSE",
};

export default async function DemographicsPage({
  searchParams,
}: {
  searchParams: Promise<{ address?: string }>;
}) {
  const { address } = await searchParams;

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold uppercase tracking-wide text-ink">
          Site Scorecard
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Full demographic summary for a trade area — pulled live from the US
          Census (ACS 5-year), in the style of the Experian report.
        </p>
      </header>

      <ScorecardTabs />

      <DemographicsReportTool initialAddress={address ?? ""} />
    </div>
  );
}
