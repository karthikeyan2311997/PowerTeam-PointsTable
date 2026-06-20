import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Team = {
  id: string;
  name: string;
  color: string;
};

export type MonthlyScore = {
  id: string;
  month_id: string;
  team_id: string;
  green_score_pct: number;
  business_amount: number;
  visitor_count: number;
  star_rank: number;
  green_points: number;
  business_points: number;
  visitor_points: number;
  star_points: number;
  total_points: number;
  teams?: Team;
};



export type ScoreInput = {
  week_id: string;
  team_id: string;
  green_score_pct: number;
  business_amount: number;
  visitor_count: number;
  star_rank: number;
};

export function computePoints(scores: ScoreInput[]): Array<ScoreInput & {
  green_points: number;
  business_points: number;
  visitor_points: number;
  star_points: number;
  total_points: number;
}> {
  const rank = (arr: number[], idx: number) => {
    const sorted = [...arr].sort((a, b) => b - a);
    const val = arr[idx];
    const pos = sorted.indexOf(val) + 1;
    // handle ties — use the first occurrence rank
    return pos;
  };

  const greenPcts = scores.map(s => s.green_score_pct);
  const businesses = scores.map(s => s.business_amount);
  const visitors = scores.map(s => s.visitor_count);

  const greenPts = [20, 10, 5, 0];
  const bizPts  = [20, 10, 5, 0];
  const visPts  = [30, 15, 5, 0];
  const starPts = [30, 15, 5, 0];

  return scores.map((s, i) => {
    const gRank = rank(greenPcts, i);
    const bRank = rank(businesses, i);
    const vRank = rank(visitors, i);
    const sRank = s.star_rank; // 1-4, 0 = unranked

    const gp = greenPts[gRank - 1] ?? 0;
    const bp = bizPts[bRank - 1] ?? 0;
    const vp = visPts[vRank - 1] ?? 0;
    const sp = sRank >= 1 && sRank <= 4 ? starPts[sRank - 1] : 0;

    return {
      ...s,
      green_points: gp,
      business_points: bp,
      visitor_points: vp,
      star_points: sp,
      total_points: gp + bp + vp + sp,
    };
  });
}

// Returns the Tuesday that starts the current week (weeks run Tue–Mon).
export function getMonthId(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

export function monthIdToLabel(monthId: string): string {
  const [year, month] = monthId.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });
}

export function getWeekId(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // getUTCDay(): 0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat
  // offset back to most recent Tuesday
  const day = d.getUTCDay(); // 0–6
  const offsetToWednesday = (day + 7 - 3) % 7; // days since last Wednesday
  d.setUTCDate(d.getUTCDate() - offsetToWednesday);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dayStr = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${dayStr}`;
}

export function weekIdToLabel(weekId: string): string {
  let start: Date;
  if (weekId.includes('W')) {
    // Legacy ISO week format: YYYY-Www — derive Monday then shift to Wednesday
    const [yearStr, weekPart] = weekId.split('-W');
    const year = parseInt(yearStr, 10);
    const week = parseInt(weekPart, 10);
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const monday = new Date(jan4);
    monday.setUTCDate(jan4.getUTCDate() - (jan4.getUTCDay() || 7) + 1 + (week - 1) * 7);
    // Shift to Wednesday of that ISO week
    start = new Date(monday);
    start.setUTCDate(monday.getUTCDate() + 2);
  } else {
    const [year, month, day] = weekId.split('-').map(Number);
    start = new Date(Date.UTC(year, month - 1, day));
  }
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `${fmt(start)} – ${fmt(end)}, ${start.getUTCFullYear()}`;
}
