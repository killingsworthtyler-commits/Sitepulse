import type { Grade } from "@/lib/scorecard/modwash";
import type { HeatPoint } from "./heatmap";

export interface Candidate {
  id: string;
  /** e.g. "Near Walmart Supercenter". */
  name: string;
  lat: number;
  lng: number;
  percent: number;
  grade: Grade;
  /** Traffic-driver grade of the anchor this candidate sits by. */
  anchorGrade: string;
  trafficCount: number;
  competition: number;
  population: number;
  qualityOfCompetition: string;
  medianIncome: number;
  trafficDriver: string;
  dataPoints: number;
}

export interface SearchAreaResult {
  ok: boolean;
  error?: string;
  center: { lat: number; lng: number };
  candidates: Candidate[];
  heatmap: HeatPoint[];
}
