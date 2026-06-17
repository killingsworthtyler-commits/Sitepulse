// One-time: geocode the ModWash operational sites and bake lat/lng into a static
// file the app loads directly (no runtime geocoding of ~140 sites).
//   node scripts/geocode-locations.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const RAW = join(here, "..", "lib", "prospect", "modwash-locations.raw.json");
const OUT = join(here, "..", "lib", "prospect", "modwash-locations.json");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function geocodeOneline(oneline) {
  const url =
    "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress" +
    `?address=${encodeURIComponent(oneline)}` +
    "&benchmark=Public_AR_Current&format=json";
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const m = data?.result?.addressMatches?.[0];
    if (!m) return null;
    return { lat: m.coordinates.y, lng: m.coordinates.x, src: "census" };
  } catch {
    return null;
  }
}

// OSM Nominatim fallback (1 req/sec, requires a descriptive User-Agent).
let lastNom = 0;
async function geocodeNominatim(params) {
  const wait = 1100 - (Date.now() - lastNom);
  if (wait > 0) await sleep(wait);
  lastNom = Date.now();
  const qs = new URLSearchParams({ format: "json", limit: "1", country: "USA", ...params });
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${qs}`, {
      headers: { "User-Agent": "SitePulse/1.0 (Hutton site prospecting)" },
    });
    if (!res.ok) return null;
    const arr = await res.json();
    if (!Array.isArray(arr) || arr.length === 0) return null;
    return { lat: Number(arr[0].lat), lng: Number(arr[0].lon), src: "osm" };
  } catch {
    return null;
  }
}

// Final fallback: ZIP centroid from Zippopotam.us (free, no key, no rate limit).
async function geocodeZip(zip) {
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
    if (!res.ok) return null;
    const data = await res.json();
    const p = data?.places?.[0];
    if (!p) return null;
    return { lat: Number(p.latitude), lng: Number(p.longitude), src: "zip" };
  } catch {
    return null;
  }
}

const sites = JSON.parse(readFileSync(RAW, "utf8"));
console.log(`Geocoding ${sites.length} sites...`);

const out = [];
const misses = [];
for (const s of sites) {
  const full = `${s.street}, ${s.city}, ${s.state} ${s.zip}`;
  // Census street match → OSM street match → OSM ZIP centroid (always lands).
  let geo = await geocodeOneline(full);
  if (!geo) {
    geo = await geocodeNominatim({
      street: s.street,
      city: s.city,
      state: s.state,
      postalcode: s.zip,
    });
  }
  if (!geo) geo = await geocodeNominatim({ postalcode: s.zip, state: s.state });
  if (!geo) geo = await geocodeZip(s.zip);
  if (geo) {
    out.push({
      code: s.code,
      name: s.name,
      city: s.city,
      state: s.state,
      street: s.street,
      zip: s.zip,
      region: s.region,
      district: s.district,
      lat: Math.round(geo.lat * 1e6) / 1e6,
      lng: Math.round(geo.lng * 1e6) / 1e6,
      geo: geo.src,
    });
    process.stdout.write(`  ✓ ${s.code} ${s.city}, ${s.state} (${geo.src})\n`);
  } else {
    misses.push(s);
    process.stdout.write(`  ✗ ${s.code} ${s.city}, ${s.state} — no match\n`);
  }
  await sleep(100);
}

out.sort((a, b) => a.code.localeCompare(b.code));
writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
console.log(`\nDone. Geocoded ${out.length}/${sites.length}. Misses: ${misses.length}`);
if (misses.length) console.log("Missed:", misses.map((m) => `${m.code} ${m.city},${m.state}`).join(" | "));
