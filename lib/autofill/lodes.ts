import zlib from "node:zlib";

// US Census LEHD LODES — Workplace Area Characteristics (jobs by workplace).
// Free flat files (one small .csv.gz per state). We fetch once per state, sum
// jobs (C000) into a block-group map, and cache it for the server's lifetime.

const FIPS_TO_ABBR: Record<string, string> = {
  "01": "al", "02": "ak", "04": "az", "05": "ar", "06": "ca", "08": "co",
  "09": "ct", "10": "de", "11": "dc", "12": "fl", "13": "ga", "15": "hi",
  "16": "id", "17": "il", "18": "in", "19": "ia", "20": "ks", "21": "ky",
  "22": "la", "23": "me", "24": "md", "25": "ma", "26": "mi", "27": "mn",
  "28": "ms", "29": "mo", "30": "mt", "31": "ne", "32": "nv", "33": "nh",
  "34": "nj", "35": "nm", "36": "ny", "37": "nc", "38": "nd", "39": "oh",
  "40": "ok", "41": "or", "42": "pa", "44": "ri", "45": "sc", "46": "sd",
  "47": "tn", "48": "tx", "49": "ut", "50": "vt", "51": "va", "53": "wa",
  "54": "wv", "55": "wi", "56": "wy",
};

// state FIPS -> (block-group GEOID -> total jobs)
const cache = new Map<string, Map<string, number>>();

async function loadStateJobs(
  stateFips: string,
  year: number,
): Promise<Map<string, number> | null> {
  const cached = cache.get(stateFips);
  if (cached) return cached;

  const abbr = FIPS_TO_ABBR[stateFips];
  if (!abbr) return null;

  const url = `https://lehd.ces.census.gov/data/lodes/LODES8/${abbr}/wac/${abbr}_wac_S000_JT00_${year}.csv.gz`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const csv = zlib.gunzipSync(buf).toString("utf8");
    const lines = csv.split("\n");
    const map = new Map<string, number>();
    // header: w_geocode,C000,...  — w_geocode is the 15-digit block code
    for (let i = 1; i < lines.length; i++) {
      const comma = lines[i].indexOf(",");
      if (comma < 0) continue;
      const block = lines[i].slice(0, comma);
      const jobs = Number(lines[i].slice(comma + 1, lines[i].indexOf(",", comma + 1)));
      if (!block || !jobs) continue;
      const bg = block.slice(0, 12); // block group = first 12 digits
      map.set(bg, (map.get(bg) ?? 0) + jobs);
    }
    cache.set(stateFips, map);
    return map;
  } catch {
    return null;
  }
}

/** Total jobs located within the ring (sum over its block groups). */
export async function getRingJobs(
  stateFips: string,
  bgGeoids: string[],
  year = 2021,
): Promise<number | null> {
  const map = await loadStateJobs(stateFips, year);
  if (!map) return null;
  let total = 0;
  for (const g of bgGeoids) total += map.get(g) ?? 0;
  return total;
}
