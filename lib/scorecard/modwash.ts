// ModWash site-selection scorecard — the exact weighted model reverse-engineered
// from Hutton's spreadsheets. Each criterion scores 0–3 (A=3/B=2/C=1/D=0) and is
// multiplied by its weight. Score = earned ÷ possible. The model also drives the
// interactive scoring form, so the form and the math can never drift apart.
//
// Two variants: "northern" markets include Snow Days (72 pts possible); "southern"
// markets drop it (69 pts). Variant is auto-suggested by latitude elsewhere.

export type Grade = "A" | "B" | "C";
export type Variant = "northern" | "southern";

export interface NumericField {
  kind: "numeric";
  id: string;
  label: string;
  unit?: string;
  help?: string;
  /** Thresholds for 3 / 2 / 1 points; below the lowest scores 0. */
  thresholds: [number, number, number];
  /** "higher" → value ≥ threshold earns the points; "lower" → value ≤ threshold. */
  direction: "higher" | "lower";
}

export interface SelectOption {
  value: string;
  points: 0 | 1 | 2 | 3;
}

export interface SelectField {
  kind: "select";
  id: string;
  label: string;
  help?: string;
  options: SelectOption[];
}

export interface CompositeField {
  kind: "composite";
  id: string;
  label: string;
  children: (NumericField | SelectField)[];
  /** Maps the summed child points → rating; bands sorted high→low by `min`. */
  bands: { min: number; points: 0 | 1 | 2 | 3; label: string }[];
}

export type Field = NumericField | SelectField | CompositeField;

export interface Criterion {
  field: Field;
  weight: number;
  /** If set, the criterion only applies to this variant (Snow Days = northern). */
  variant?: Variant;
}

// ---------------------------------------------------------------------------
// The model
// ---------------------------------------------------------------------------

export const MODWASH_CRITERIA: Criterion[] = [
  {
    weight: 3,
    field: {
      kind: "numeric",
      id: "trafficCount",
      label: "Traffic Count (AADT)",
      unit: "vpd",
      thresholds: [30000, 22000, 15000],
      direction: "higher",
    },
  },
  {
    weight: 5,
    field: {
      kind: "numeric",
      id: "competition",
      label: "Competition (washes in trade area)",
      help: "Number of competing car washes. Also drives Population per Car Wash.",
      thresholds: [0, 1, 2],
      direction: "lower",
    },
  },
  {
    weight: 2,
    field: {
      kind: "select",
      id: "qualityOfCompetition",
      label: "Quality of Competition",
      options: [
        { value: "None", points: 3 },
        { value: "One-Off Operator", points: 2 },
        { value: "Local, Few Unit Operator", points: 1 },
        { value: "National Express Wash", points: 0 },
      ],
    },
  },
  {
    weight: 5,
    field: {
      kind: "numeric",
      id: "popPerWash",
      label: "Total Population per Car Wash",
      help: "Auto-computed: trade-area population ÷ (1 + competition).",
      thresholds: [20000, 15000, 10000],
      direction: "higher",
    },
  },
  {
    weight: 3,
    field: {
      kind: "composite",
      id: "market",
      label: "Market",
      bands: [
        { min: 11, points: 3, label: "Excellent" },
        { min: 9, points: 2, label: "Good" },
        { min: 7, points: 1, label: "Limited" },
        { min: 0, points: 1, label: "Bad" },
      ],
      children: [
        {
          kind: "numeric",
          id: "medianIncome",
          label: "Median Household Income",
          unit: "$",
          thresholds: [70000, 50000, 35000],
          direction: "higher",
        },
        {
          kind: "numeric",
          id: "daytimePop",
          label: "Daytime Population (TA)",
          thresholds: [20000, 14000, 9000],
          direction: "higher",
        },
        {
          kind: "numeric",
          id: "projGrowth",
          label: "Projected Population Growth",
          unit: "%",
          help: "Enter as a percent, e.g. 1.2 for 1.2%.",
          thresholds: [1, 0.5, 0],
          direction: "higher",
        },
        {
          kind: "select",
          id: "trafficDriver",
          label: "Quality of Traffic Driver nearby",
          help: "A: Walmart/Target/Publix · B: Food Lion/Aldi · C: strong gas/strip · D: QSR/weak",
          options: [
            { value: "A", points: 3 },
            { value: "B", points: 2 },
            { value: "C", points: 1 },
            { value: "D", points: 0 },
          ],
        },
      ],
    },
  },
  {
    weight: 2,
    field: {
      kind: "composite",
      id: "visibility",
      label: "Visibility",
      bands: [
        { min: 7, points: 3, label: "Excellent" },
        { min: 4, points: 2, label: "Good" },
        { min: 2, points: 1, label: "Limited" },
        { min: 0, points: 0, label: "Bad" },
      ],
      children: [
        {
          kind: "numeric",
          id: "trafficSpeed",
          label: "Traffic Speed",
          unit: "mph",
          thresholds: [35, 40, 45],
          direction: "lower",
        },
        {
          kind: "select",
          id: "sightLine",
          label: "Sight Line",
          options: [
            { value: "More Than 500 Feet Both Directions", points: 3 },
            { value: "400 - 500 Feet Both Directions", points: 2 },
            { value: "300 - 400 Feet Both Directions", points: 1 },
            { value: "Limited / Blocked", points: 0 },
          ],
        },
        {
          kind: "select",
          id: "offBlock",
          label: "Off-Block",
          options: [
            { value: "No", points: 3 },
            { value: "Yes", points: 1 },
          ],
        },
      ],
    },
  },
  {
    weight: 2,
    field: {
      kind: "composite",
      id: "ingress",
      label: "Ingress / Egress",
      bands: [
        { min: 6, points: 3, label: "Excellent" },
        { min: 4, points: 2, label: "Good" },
        { min: 1, points: 1, label: "Limited" },
        { min: 0, points: 0, label: "Bad" },
      ],
      children: [
        {
          kind: "select",
          id: "directAccess",
          label: "Direct Access",
          options: [
            { value: "Full Access", points: 3 },
            { value: "3/4 Access", points: 2 },
            { value: "RI/RO only", points: 1 },
            { value: "None", points: 0 },
          ],
        },
        {
          kind: "select",
          id: "typeOfSite",
          label: "Type of Site",
          options: [
            { value: "Signalized / Direct Full Access", points: 3 },
            { value: "Frontage Rd / Ring Rd", points: 2 },
            { value: "Via Shopping Center", points: 1 },
            { value: "None", points: 0 },
          ],
        },
      ],
    },
  },
  {
    weight: 1,
    field: {
      kind: "composite",
      id: "siteLayout",
      label: "Site Layout",
      bands: [
        { min: 8, points: 3, label: "Excellent" },
        { min: 5, points: 2, label: "Good" },
        { min: 3, points: 1, label: "Poor" },
        { min: 0, points: 1, label: "Bad" },
      ],
      children: [
        {
          kind: "select",
          id: "payStations",
          label: "Number of Pay Stations",
          options: [
            { value: "3+", points: 3 },
            { value: "2", points: 2 },
            { value: "1", points: 1 },
            { value: "0", points: 0 },
          ],
        },
        {
          kind: "select",
          id: "vacuumSlots",
          label: "Vacuum Slots",
          options: [
            { value: "More than 18 Vacuums", points: 3 },
            { value: "12 - 18 Vacuums", points: 2 },
            { value: "8 - 12 Vacuums", points: 1 },
            { value: "Less than 8 Vacuums", points: 0 },
          ],
        },
        {
          kind: "select",
          id: "memberLane",
          label: "Member Only Lane?",
          options: [
            { value: "Yes", points: 3 },
            { value: "No", points: 1 },
          ],
        },
      ],
    },
  },
  {
    weight: 1,
    variant: "northern",
    field: {
      kind: "numeric",
      id: "snowDays",
      label: "Snow Days per Year",
      thresholds: [15, 6, 1],
      direction: "higher",
    },
  },
];

// ---------------------------------------------------------------------------
// Inputs + scoring
// ---------------------------------------------------------------------------

/** Raw site inputs. `population` is a helper that drives `popPerWash`. */
export interface ScorecardInputs {
  trafficCount: number;
  competition: number;
  population: number;
  qualityOfCompetition: string;
  medianIncome: number;
  daytimePop: number;
  projGrowth: number;
  trafficDriver: string;
  trafficSpeed: number;
  sightLine: string;
  offBlock: string;
  directAccess: string;
  typeOfSite: string;
  payStations: string;
  vacuumSlots: string;
  memberLane: string;
  snowDays: number;
}

function numericPoints(f: NumericField, value: number): number {
  const [a, b, c] = f.thresholds;
  if (f.direction === "higher") {
    return value >= a ? 3 : value >= b ? 2 : value >= c ? 1 : 0;
  }
  return value <= a ? 3 : value <= b ? 2 : value <= c ? 1 : 0;
}

function selectPoints(f: SelectField, value: string): number {
  return f.options.find((o) => o.value === value)?.points ?? 0;
}

/** Population ÷ (1 + competition), the spreadsheet's Total Population per Car Wash. */
export function popPerWash(inputs: ScorecardInputs): number {
  return inputs.population / (1 + Math.max(0, inputs.competition));
}

function fieldValue(field: Field, inputs: ScorecardInputs): number | string {
  if (field.id === "popPerWash") return popPerWash(inputs);
  return (inputs as unknown as Record<string, number | string>)[field.id];
}

function leafPoints(
  field: NumericField | SelectField,
  inputs: ScorecardInputs,
): number {
  if (field.kind === "numeric") {
    return numericPoints(field, Number(fieldValue(field, inputs)));
  }
  return selectPoints(field, String(fieldValue(field, inputs)));
}

export interface CriterionResult {
  id: string;
  label: string;
  weight: number;
  points: number; // 0–3
  earned: number; // points × weight
  possible: number; // 3 × weight
  /** For composites: the rating label (Excellent/Good/…). */
  rating?: string;
}

export interface ScoreResult {
  variant: Variant;
  criteria: CriterionResult[];
  earned: number;
  possible: number;
  percent: number; // 0–1
  grade: Grade;
}

export function gradeFor(percent: number): Grade {
  if (percent > 0.85) return "A";
  if (percent >= 0.75) return "B";
  return "C";
}

export function scoreSite(
  inputs: ScorecardInputs,
  variant: Variant,
): ScoreResult {
  const criteria: CriterionResult[] = [];

  for (const c of MODWASH_CRITERIA) {
    if (c.variant && c.variant !== variant) continue;

    let points: number;
    let rating: string | undefined;

    if (c.field.kind === "composite") {
      const sum = c.field.children.reduce(
        (acc, child) => acc + leafPoints(child, inputs),
        0,
      );
      const band =
        c.field.bands.find((b) => sum >= b.min) ??
        c.field.bands[c.field.bands.length - 1];
      points = band.points;
      rating = band.label;
    } else {
      points = leafPoints(c.field, inputs);
    }

    criteria.push({
      id: c.field.id,
      label: c.field.label,
      weight: c.weight,
      points,
      earned: points * c.weight,
      possible: 3 * c.weight,
      rating,
    });
  }

  const earned = criteria.reduce((a, c) => a + c.earned, 0);
  const possible = criteria.reduce((a, c) => a + c.possible, 0);
  const percent = possible ? earned / possible : 0;

  return { variant, criteria, earned, possible, percent, grade: gradeFor(percent) };
}
