// Competition + traffic-driver detection.
//
// Two modes:
//  - LIVE: Google Places API (New) — searchNearby for car washes (competition)
//    and retail anchors (traffic driver). Needs GOOGLE_MAPS_API_KEY.
//  - MOCK: deterministic placeholder derived from the address, clearly flagged,
//    used when no key is configured.

export interface CompetitionInfo {
  count: number;
  quality: string;
  trafficDriver: string;
  mock: boolean;
}

// ---------------------------------------------------------------------------
// MOCK (fallback when no key)
// ---------------------------------------------------------------------------

const QUALITIES = [
  "One-Off Operator",
  "Local, Few Unit Operator",
  "National Express Wash",
];
const DRIVERS = ["A", "B", "C", "D"];

export function detectCompetition(address: string): CompetitionInfo {
  const h = [...address].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const count = h % 4; // 0–3
  return {
    count,
    quality: count === 0 ? "None" : QUALITIES[h % QUALITIES.length],
    trafficDriver: DRIVERS[h % DRIVERS.length],
    mock: true,
  };
}

// ---------------------------------------------------------------------------
// LIVE — Google Places API (New)
// ---------------------------------------------------------------------------

const NATIONAL_EXPRESS = [
  "mister car wash", "take 5", "tidal wave", "quick quack", "club car wash",
  "go car wash", "whistle express", "spotless", "zips car wash", "el car wash",
  "super star car wash", "caliber car wash", "whitewater express", "autobell",
  "splash car wash", "flagstop", "wash u", "true blue", "tommy's express",
];

// Traffic-driver rubric (from the scorecard): A best → D weakest.
const A_BRANDS = [
  "walmart", "target", "publix", "harris teeter", "wegmans", "home depot",
  "lowe's", "lowes", "costco", "sam's club", "whole foods", "kroger", "heb",
  "h-e-b", "meijer", "trader joe",
];
const B_BRANDS = ["food lion", "winn-dixie", "winn dixie", "aldi", "lidl", "save a lot", "save-a-lot"];
const C_BRANDS = [
  "quiktrip", "wawa", "racetrac", "sheetz", "buc-ee", "circle k", "dollar general",
  "dollar tree", "family dollar", "ace hardware", "tractor supply", "cvs", "walgreens",
];

interface PlaceLite {
  name: string;
  primaryType?: string;
  types: string[];
}

export interface Anchor {
  name: string;
  lat: number;
  lng: number;
  /** Traffic-driver grade from the scorecard rubric (A best → D). */
  grade: "A" | "B" | "C" | "D";
  primaryType?: string;
}

const ANCHOR_TYPES = [
  "supermarket", "grocery_store", "department_store", "home_improvement_store",
  "discount_store", "warehouse_store", "shopping_mall",
];

/** Retail anchors within `radius` m of a point, each with its location + grade.
    These are the candidate sites for prospecting — a car wash wants to sit by a
    strong traffic driver. Returns [] on failure. Needs a key. */
export async function findAnchors(
  lat: number,
  lng: number,
  radius: number,
  key: string,
): Promise<Anchor[]> {
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "places.displayName,places.location,places.primaryType,places.types",
      },
      body: JSON.stringify({
        includedTypes: ANCHOR_TYPES,
        maxResultCount: 20,
        locationRestriction: {
          circle: { center: { latitude: lat, longitude: lng }, radius },
        },
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.places ?? [])
      .map(
        (p: {
          displayName?: { text?: string };
          location?: { latitude?: number; longitude?: number };
          primaryType?: string;
          types?: string[];
        }): Anchor | null => {
          const lt = p.location?.latitude;
          const lg = p.location?.longitude;
          const name = p.displayName?.text ?? "";
          if (lt == null || lg == null || !name) return null;
          const lite: PlaceLite = {
            name,
            primaryType: p.primaryType,
            types: p.types ?? [],
          };
          return {
            name,
            lat: lt,
            lng: lg,
            grade: gradeAnchor(lite),
            primaryType: p.primaryType,
          };
        },
      )
      .filter(Boolean) as Anchor[];
  } catch {
    return [];
  }
}

async function searchNearby(
  lat: number,
  lng: number,
  radius: number,
  includedTypes: string[],
  key: string,
): Promise<PlaceLite[] | null> {
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.displayName,places.primaryType,places.types",
      },
      body: JSON.stringify({
        includedTypes,
        maxResultCount: 20,
        locationRestriction: {
          circle: { center: { latitude: lat, longitude: lng }, radius },
        },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.places ?? []).map(
      (p: {
        displayName?: { text?: string };
        primaryType?: string;
        types?: string[];
      }): PlaceLite => ({
        name: p.displayName?.text ?? "",
        primaryType: p.primaryType,
        types: p.types ?? [],
      }),
    );
  } catch {
    return null;
  }
}

function classifyCarWashQuality(names: string[]): string {
  if (names.length === 0) return "None";
  const lower = names.map((n) => n.toLowerCase());
  if (lower.some((n) => NATIONAL_EXPRESS.some((b) => n.includes(b)))) {
    return "National Express Wash";
  }
  // Few-unit operator: 2+ washes sharing the same leading brand word.
  const brandCounts = new Map<string, number>();
  for (const n of lower) {
    const brand = n.split(/\s+/).slice(0, 2).join(" ");
    brandCounts.set(brand, (brandCounts.get(brand) ?? 0) + 1);
  }
  if ([...brandCounts.values()].some((c) => c >= 2)) {
    return "Local, Few Unit Operator";
  }
  return "One-Off Operator";
}

// A Places "car_wash" search returns every kind of wash — gas-station bays,
// self-serve/coin, hand washes, mobile detailers, and our own ModWash stores.
// The scorecard's "competition" means the standalone express/automatic washes
// we actually compete with, so we drop the rest before counting.
const OWN_BRANDS = ["modwash", "mod wash"];
// A primary type that alone means "not an express competitor".
const NON_COMPETITOR_PRIMARY = new Set([
  "gas_station",
  "convenience_store",
  "service", // mobile detailers
]);
// Secondary types that flag a gas/convenience site even when primary = car_wash.
// NOT "service" — Google tags *every* establishment with it, so it can't filter.
const NON_COMPETITOR_TYPE = new Set(["gas_station", "convenience_store"]);
const NON_COMPETITOR_NAME = [
  // self-serve / coin / hand / detail / mobile — not express tunnels
  "self serve", "self-serve", "self service", "self-service",
  "coin", "hand wash", "hand car wash", "detail", "mobile",
  "u-wash", "u wash", "do it yourself", "do-it-yourself",
  "spot free", "spot-free", "in bay", "in-bay",
  // gas / convenience brands that still come back typed car_wash
  "circle k", "amoco", "exxon", "shell", "marathon", "speedway",
  "wawa", "sheetz", "racetrac", "quiktrip", "kwik trip", "murphy",
  "sunoco", "valero", "chevron", "7-eleven",
];

/** True if a "car_wash" result is a real express/automatic competitor (not a
    gas-station bay, self-serve/coin, detailer, or one of our own stores). */
// Unbranded "Car Wash" pins are almost always self-serve/coin bays — a real
// express competitor carries a brand name.
const GENERIC_NAMES = new Set(["car wash", "carwash", "the car wash", "car wash."]);

function isCompetitor(p: PlaceLite): boolean {
  const n = p.name.toLowerCase().trim();
  if (!n) return false;
  if (GENERIC_NAMES.has(n)) return false;
  if (OWN_BRANDS.some((b) => n.includes(b))) return false;
  if (NON_COMPETITOR_PRIMARY.has(p.primaryType ?? "")) return false;
  if (p.types.some((t) => NON_COMPETITOR_TYPE.has(t))) return false;
  if (NON_COMPETITOR_NAME.some((k) => n.includes(k))) return false;
  return true;
}

export interface Competitor {
  name: string;
  lat: number;
  lng: number;
}

/** Competing car washes (with coordinates) within `radius` m, for the map.
    Same filter as the competition count. Returns [] on failure. Needs a key. */
export async function findCompetitors(
  lat: number,
  lng: number,
  radius: number,
  key: string,
): Promise<Competitor[]> {
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "places.displayName,places.location,places.primaryType,places.types",
      },
      body: JSON.stringify({
        includedTypes: ["car_wash"],
        maxResultCount: 20,
        locationRestriction: {
          circle: { center: { latitude: lat, longitude: lng }, radius },
        },
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.places ?? [])
      .map(
        (p: {
          displayName?: { text?: string };
          location?: { latitude?: number; longitude?: number };
          primaryType?: string;
          types?: string[];
        }): Competitor | null => {
          const name = p.displayName?.text ?? "";
          const lt = p.location?.latitude;
          const lg = p.location?.longitude;
          if (!name || lt == null || lg == null) return null;
          const lite: PlaceLite = { name, primaryType: p.primaryType, types: p.types ?? [] };
          if (!isCompetitor(lite)) return null;
          return { name, lat: lt, lng: lg };
        },
      )
      .filter(Boolean) as Competitor[];
  } catch {
    return [];
  }
}

/** Live competition: competing express/automatic car washes within ~3 mi.
    Filters out gas/self-serve/detail washes + our own stores. Null on failure. */
export async function detectCompetitionPlaces(
  lat: number,
  lng: number,
  key: string,
): Promise<{ count: number; quality: string } | null> {
  const places = await searchNearby(lat, lng, 4828, ["car_wash"], key);
  if (places === null) return null;
  const names = places.filter(isCompetitor).map((p) => p.name).filter(Boolean);
  return { count: names.length, quality: classifyCarWashQuality(names) };
}

function gradeAnchor(p: PlaceLite): "A" | "B" | "C" | "D" {
  const n = p.name.toLowerCase();
  if (A_BRANDS.some((b) => n.includes(b))) return "A";
  if (B_BRANDS.some((b) => n.includes(b))) return "B";
  if (C_BRANDS.some((b) => n.includes(b))) return "C";
  // Fall back to the place type when the brand isn't recognized.
  const t = [p.primaryType ?? "", ...p.types].join(" ");
  if (/home_improvement|department_store|warehouse|wholesale/.test(t)) return "A";
  if (/supermarket|grocery/.test(t)) return "B";
  if (/discount|convenience|gas_station|drugstore|pharmacy/.test(t)) return "C";
  return "D";
}

/** Live traffic driver: best-graded retail anchor within ~1 mi. Null on failure. */
export async function detectTrafficDriverPlaces(
  lat: number,
  lng: number,
  key: string,
): Promise<string | null> {
  const places = await searchNearby(
    lat,
    lng,
    1609,
    [
      "supermarket", "grocery_store", "department_store", "home_improvement_store",
      "discount_store", "warehouse_store", "shopping_mall", "convenience_store",
    ],
    key,
  );
  if (places === null) return null;
  if (places.length === 0) return "D";
  const order = { A: 4, B: 3, C: 2, D: 1 } as const;
  let best: "A" | "B" | "C" | "D" = "D";
  for (const p of places) {
    const g = gradeAnchor(p);
    if (order[g] > order[best]) best = g;
  }
  return best;
}
