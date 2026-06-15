import { scoreSite, type ScorecardInputs, type Variant, type ScoreResult } from "./modwash";

// Real ModWash sites scored in Hutton's spreadsheets. We store the raw inputs and
// recompute with the engine — so these double as a validation set (the engine
// reproduces the spreadsheet scores exactly: West Palm 100%, Carlisle 81.2%,
// Inman 91.3%, Jacksonville 55.1%, Lady Lake 40.6%, Rocky Mount 42.0%).

export interface ScoredSite {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  scoredOn: string; // ISO date
  variant: Variant;
  inputs: ScorecardInputs;
}

export const MODWASH_SITES: ScoredSite[] = [
  {
    id: "west-palm",
    name: "West Palm Beach",
    address: "921 Palm Beach Lakes Blvd",
    city: "West Palm Beach",
    state: "FL",
    scoredOn: "2026-05-08",
    variant: "southern",
    inputs: {
      trafficCount: 31318, competition: 0, population: 32581,
      qualityOfCompetition: "None", medianIncome: 56828, daytimePop: 84332,
      projGrowth: 2.67, trafficDriver: "A", trafficSpeed: 30,
      sightLine: "More Than 500 Feet Both Directions", offBlock: "No",
      directAccess: "Full Access", typeOfSite: "Signalized / Direct Full Access",
      payStations: "3+", vacuumSlots: "More than 18 Vacuums", memberLane: "Yes",
      snowDays: 0,
    },
  },
  {
    id: "inman",
    name: "Inman",
    address: "11931 Asheville Hwy",
    city: "Inman",
    state: "SC",
    scoredOn: "2026-04-13",
    variant: "southern",
    inputs: {
      trafficCount: 25585, competition: 0, population: 24567,
      qualityOfCompetition: "None", medianIncome: 62468, daytimePop: 15943,
      projGrowth: 5.2, trafficDriver: "B", trafficSpeed: 35,
      sightLine: "More Than 500 Feet Both Directions", offBlock: "No",
      directAccess: "Full Access", typeOfSite: "Signalized / Direct Full Access",
      payStations: "3+", vacuumSlots: "More than 18 Vacuums", memberLane: "Yes",
      snowDays: 0,
    },
  },
  {
    id: "carlisle",
    name: "Carlisle (Trindle Rd)",
    address: "1900 W Trindle Rd",
    city: "Carlisle",
    state: "PA",
    scoredOn: "2026-05-08",
    variant: "southern",
    inputs: {
      trafficCount: 13000, competition: 0, population: 76155,
      qualityOfCompetition: "None", medianIncome: 76191, daytimePop: 86932,
      projGrowth: 1.27, trafficDriver: "A", trafficSpeed: 35,
      sightLine: "More Than 500 Feet Both Directions", offBlock: "No",
      directAccess: "Full Access", typeOfSite: "None",
      payStations: "3+", vacuumSlots: "More than 18 Vacuums", memberLane: "Yes",
      snowDays: 0,
    },
  },
  {
    id: "jacksonville",
    name: "Jacksonville (University)",
    address: "5730 University Blvd W",
    city: "Jacksonville",
    state: "FL",
    scoredOn: "2026-05-26",
    variant: "southern",
    inputs: {
      trafficCount: 41237, competition: 4, population: 63961,
      qualityOfCompetition: "National Express Wash", medianIncome: 65816, daytimePop: 141432,
      projGrowth: 3.99, trafficDriver: "A", trafficSpeed: 35,
      sightLine: "More Than 500 Feet Both Directions", offBlock: "No",
      directAccess: "Full Access", typeOfSite: "Signalized / Direct Full Access",
      payStations: "3+", vacuumSlots: "More than 18 Vacuums", memberLane: "Yes",
      snowDays: 0,
    },
  },
  {
    id: "rocky-mount",
    name: "Rocky Mount",
    address: "N Wesleyan Blvd",
    city: "Rocky Mount",
    state: "NC",
    scoredOn: "2026-05-11",
    variant: "southern",
    inputs: {
      trafficCount: 10712, competition: 1, population: 15810,
      qualityOfCompetition: "National Express Wash", medianIncome: 68870, daytimePop: 19368,
      projGrowth: 2.43, trafficDriver: "B", trafficSpeed: 45,
      sightLine: "More Than 500 Feet Both Directions", offBlock: "No",
      directAccess: "Full Access", typeOfSite: "Via Shopping Center",
      payStations: "3+", vacuumSlots: "More than 18 Vacuums", memberLane: "Yes",
      snowDays: 0,
    },
  },
  {
    id: "lady-lake",
    name: "Lady Lake",
    address: "929 US-441",
    city: "Fruitland Park",
    state: "FL",
    scoredOn: "2026-05-07",
    variant: "southern",
    inputs: {
      trafficCount: 20558, competition: 4, population: 70092,
      qualityOfCompetition: "National Express Wash", medianIncome: 56663, daytimePop: 73835,
      projGrowth: 3.77, trafficDriver: "A", trafficSpeed: 45,
      sightLine: "More Than 500 Feet Both Directions", offBlock: "No",
      directAccess: "RI/RO only", typeOfSite: "None",
      payStations: "3+", vacuumSlots: "More than 18 Vacuums", memberLane: "Yes",
      snowDays: 0,
    },
  },
];

export interface ScoredSiteResult extends ScoredSite {
  result: ScoreResult;
}

export function getModwashSites(): ScoredSiteResult[] {
  return MODWASH_SITES.map((s) => ({ ...s, result: scoreSite(s.inputs, s.variant) }));
}
