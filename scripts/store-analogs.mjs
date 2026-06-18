// One-time precompute: the 3-mile analog footprint (population, median income,
// median age, density) for every operational ModWash store. Writes
// lib/analogs/store-analogs.json, the baseline that match.ts compares a
// candidate against. Re-run if the store list changes.
//
//   node scripts/store-analogs.mjs
//
// Mirrors lib/analogs/variables.ts EXACTLY so stores and candidates are
// measured the same way. Reads CENSUS_API_KEY from .env.local.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const TIGER_BG =
  "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer/10/query";
const RADIUS_MI = 3;
const RADIUS_M = RADIUS_MI * 1609.34;
const AREA_SQMI = Math.PI * RADIUS_MI * RADIUS_MI;

// --- load CENSUS_API_KEY from .env.local ---
function loadKey() {
  const env = readFileSync(join(ROOT, ".env.local"), "utf8");
  const m = env.match(/^CENSUS_API_KEY=(.*)$/m);
  if (!m) throw new Error("CENSUS_API_KEY not found in .env.local");
  return m[1].trim().replace(/^["']|["']$/g, "");
}

function haversineM(aLat, aLng, bLat, bLng) {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

async function bgCentroidsWithin(lat, lng, meters) {
  const params = new URLSearchParams({
    geometry: JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } }),
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    distance: String(meters),
    units: "esriSRUnit_Meter",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "GEOID,CENTLAT,CENTLON",
    returnGeometry: "false",
    f: "json",
  });
  try {
    const res = await fetch(`${TIGER_BG}?${params.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.features ?? [])
      .map((f) => {
        const a = f.attributes ?? {};
        const la = Number(a.CENTLAT);
        const lo = Number(a.CENTLON);
        if (!a.GEOID || !Number.isFinite(la) || !Number.isFinite(lo)) return null;
        return { geoid: a.GEOID, lat: la, lng: lo };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function countyAcs(state, county, key) {
  const url =
    `https://api.census.gov/data/2023/acs/acs5?get=B01003_001E,B11001_001E,B19013_001E,B01002_001E` +
    `&for=block%20group:*&in=state:${state}%20county:${county}&key=${key}`;
  const map = new Map();
  try {
    const res = await fetch(url);
    if (!res.ok) return map;
    const rows = await res.json();
    const h = rows[0];
    const ip = h.indexOf("B01003_001E");
    const ihh = h.indexOf("B11001_001E");
    const iinc = h.indexOf("B19013_001E");
    const iage = h.indexOf("B01002_001E");
    const is = h.indexOf("state");
    const ic = h.indexOf("county");
    const it = h.indexOf("tract");
    const ib = h.indexOf("block group");
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      map.set(`${r[is]}${r[ic]}${r[it]}${r[ib]}`, {
        pop: Number(r[ip]) || 0,
        hh: Number(r[ihh]) || 0,
        income: Number(r[iinc]) || 0,
        age: Number(r[iage]) || 0,
      });
    }
  } catch {
    /* leave empty */
  }
  return map;
}

const countyCache = new Map();
async function getCountyAcs(s, co, key) {
  const id = `${s}${co}`;
  if (!countyCache.has(id)) countyCache.set(id, await countyAcs(s, co, key));
  return countyCache.get(id);
}

async function analogVariables(lat, lng, key) {
  const cents = (await bgCentroidsWithin(lat, lng, RADIUS_M)).filter(
    (c) => haversineM(lat, lng, c.lat, c.lng) <= RADIUS_M,
  );
  if (cents.length === 0) return null;

  const counties = new Map();
  for (const c of cents) {
    counties.set(c.geoid.slice(0, 5), { s: c.geoid.slice(0, 2), co: c.geoid.slice(2, 5) });
  }
  const maps = await Promise.all([...counties.values()].map((c) => getCountyAcs(c.s, c.co, key)));
  const acs = new Map();
  for (const m of maps) for (const [g, v] of m) acs.set(g, v);

  let pop = 0,
    incNum = 0,
    incDen = 0,
    ageNum = 0,
    ageDen = 0;
  for (const c of cents) {
    const v = acs.get(c.geoid);
    if (!v) continue;
    pop += v.pop;
    if (v.income > 0 && v.hh > 0) {
      incNum += v.income * v.hh;
      incDen += v.hh;
    }
    if (v.age > 0 && v.pop > 0) {
      ageNum += v.age * v.pop;
      ageDen += v.pop;
    }
  }
  if (pop <= 0) return null;
  return {
    population: Math.round(pop),
    medianIncome: incDen > 0 ? Math.round(incNum / incDen) : 0,
    medianAge: ageDen > 0 ? Math.round((ageNum / ageDen) * 10) / 10 : 0,
    density: Math.round(pop / AREA_SQMI),
  };
}

async function main() {
  const key = loadKey();
  const stores = JSON.parse(readFileSync(join(ROOT, "lib/prospect/modwash-locations.json"), "utf8"));
  const out = [];
  let done = 0;
  for (const s of stores) {
    const v = await analogVariables(s.lat, s.lng, key);
    done++;
    if (!v) {
      console.log(`  [${done}/${stores.length}] ${s.code} ${s.city} — NO DATA (skipped)`);
      continue;
    }
    out.push({
      code: s.code,
      name: s.name,
      city: s.city,
      state: s.state,
      lat: s.lat,
      lng: s.lng,
      ...v,
    });
    console.log(
      `  [${done}/${stores.length}] ${s.code} ${s.city}, ${s.state} — pop ${v.population.toLocaleString()}, $${v.medianIncome.toLocaleString()}, age ${v.medianAge}, ${v.density}/sqmi`,
    );
  }
  const path = join(ROOT, "lib/analogs/store-analogs.json");
  writeFileSync(path, JSON.stringify(out, null, 0) + "\n");
  console.log(`\nWrote ${out.length}/${stores.length} stores → lib/analogs/store-analogs.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
