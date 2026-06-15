// Competition + traffic-driver detection. This is a clearly-labeled PLACEHOLDER:
// it returns deterministic, plausible values derived from the address so the demo
// is stable, but flags itself as mock. Swap for Google Places: search "car wash"
// within the trade area for competition, and detect nearby anchors (Walmart/
// Target/Publix = A, Food Lion/Aldi = B, …) for the traffic driver.

export interface CompetitionInfo {
  count: number;
  quality: string;
  trafficDriver: string;
  mock: boolean;
}

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
