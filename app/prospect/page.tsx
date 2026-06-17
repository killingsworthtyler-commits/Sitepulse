import { getOperationalSites } from "@/lib/prospect/locations";
import { SiteFinderMap } from "@/components/site-finder-map";

// Default to roughly the center of the operational footprint.
function centerOf(sites: { lat: number; lng: number }[]): { lat: number; lng: number } {
  if (sites.length === 0) return { lat: 35.2271, lng: -80.8431 };
  const lat = sites.reduce((a, s) => a + s.lat, 0) / sites.length;
  const lng = sites.reduce((a, s) => a + s.lng, 0) / sites.length;
  return { lat, lng };
}

export default async function ProspectPage() {
  const sites = getOperationalSites();
  const center = centerOf(sites);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold uppercase tracking-wide text-ink">
          Site Finder
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {sites.length} operational ModWash sites mapped. Pan to a market and
          scan for candidate sites near strong retail anchors — each auto-scored
          on the same metrics as the scorecard.
        </p>
      </div>

      <SiteFinderMap sites={sites} center={center} />
    </div>
  );
}
