// Upgrade the ZIP-centroid pins (geo === "zip") to precise store locations via
// Google Places text search. Run once after geocode-locations.mjs:
//   node scripts/fix-zip-pins.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const FILE = join(here, "..", "lib", "prospect", "modwash-locations.json");
const ENV = join(here, "..", ".env.local");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Pull the server Places key out of .env.local.
const env = readFileSync(ENV, "utf8");
const key = (env.match(/^GOOGLE_MAPS_API_KEY=(.+)$/m) || [])[1]?.trim();
if (!key) {
  console.error("GOOGLE_MAPS_API_KEY not found in .env.local");
  process.exit(1);
}

function haversineMi(a, b) {
  const R = 3959;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(s));
}

async function placesResolve(query) {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "places.location,places.formattedAddress",
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: 1 }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const p = data?.places?.[0];
  if (!p?.location) return null;
  return { lat: p.location.latitude, lng: p.location.longitude, addr: p.formattedAddress };
}

const sites = JSON.parse(readFileSync(FILE, "utf8"));
const targets = sites.filter((s) => s.geo === "zip");
console.log(`Fixing ${targets.length} ZIP-centroid pins...`);

let fixed = 0;
for (const s of sites) {
  if (s.geo !== "zip") continue;
  const query = `ModWash ${s.street}, ${s.city}, ${s.state} ${s.zip}`;
  const r = await placesResolve(query);
  if (r) {
    const moved = haversineMi({ lat: s.lat, lng: s.lng }, r);
    s.lat = Math.round(r.lat * 1e6) / 1e6;
    s.lng = Math.round(r.lng * 1e6) / 1e6;
    s.geo = "places";
    fixed++;
    console.log(`  ✓ ${s.code} ${s.city}, ${s.state} -> ${r.addr} (moved ${moved.toFixed(1)} mi)`);
  } else {
    console.log(`  ✗ ${s.code} ${s.city}, ${s.state} — no Places match (left as ZIP centroid)`);
  }
  await sleep(150);
}

writeFileSync(FILE, JSON.stringify(sites, null, 2) + "\n");
console.log(`\nDone. Upgraded ${fixed}/${targets.length} pins to street-level.`);
