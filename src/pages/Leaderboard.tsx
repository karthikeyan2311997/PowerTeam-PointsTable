import { useEffect, useState, useCallback } from 'react';
import { Trophy, TrendingUp, Users, Star, Award, ChevronDown, RefreshCw } from 'lucide-react';
import { supabase, WeeklyScore } from '../lib/supabase';

type RankedScore = WeeklyScore & { rank: number };
type MonthlyScore = WeeklyScore & { week_count: number };

const MEDAL_COLORS = ['#F59E0B', '#94A3B8', '#CD7C2F', '#6B7280'];
const MEDAL_LABELS = ['1st', '2nd', '3rd', '4th'];

function getMonthId(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function monthIdToLabel(monthId: string): string {
  const [year, month] = monthId.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });
}

function getNextMonthId(monthId: string): string {
  const [year, month] = monthId.split('-').map(Number);
  const next = new Date(year, month, 1);
  return getMonthId(next);
}

export default function Leaderboard() {
  const [scores, setScores] = useState<RankedScore[]>([]);
  const [months, setMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(getMonthId());
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const fetchMonths = useCallback(async () => {
    const { data } = await supabase
      .from('monthly_scores')
      .select('month_id')
      .order('month_id', { ascending: false });
    if (data) {
      const unique = [...new Set(data.map(d => d.month_id))];
      setMonths(unique);
      if (unique.length > 0 && !unique.includes(selectedMonth)) {
        setSelectedMonth(unique[0]);
      }
    }
  }, [selectedMonth]);

  const fetchScores = useCallback(async (monthId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from('monthly_scores')
      .select('*, teams(id, name, color)')
      .gte('month_id', monthId)
      .lt('month_id', getNextMonthId(monthId));

    if (data && data.length > 0) {
      const totals = new Map<string, MonthlyScore>();
      data.forEach(score => {
        const existing = totals.get(score.team_id);
        if (!existing) {
          totals.set(score.team_id, { ...score, month_id: monthId, week_count: 1 });
          return;
        }

        existing.green_score_pct += score.green_score_pct;
        existing.business_amount += score.business_amount;
        existing.visitor_count += score.visitor_count;
        existing.green_points += score.green_points;
        existing.business_points += score.business_points;
        existing.visitor_points += score.visitor_points;
        existing.star_points += score.star_points;
        existing.total_points += score.total_points;
        existing.week_count += 1;
      });

      const monthlyScores = [...totals.values()]
        .map(score => ({
          ...score,
          green_score_pct: Math.round(score.green_score_pct / score.week_count),
          star_rank: 0,
        }))
        .sort((a, b) => b.total_points - a.total_points);

      let rank = 1;
      const ranked: RankedScore[] = monthlyScores.map((s, i) => {
        if (i > 0 && s.total_points < monthlyScores[i - 1].total_points) rank = i + 1;
        return { ...s, rank };
      });
      setScores(ranked);
    } else {
      setScores([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMonths();
  }, [fetchMonths]);

  useEffect(() => {
    fetchScores(selectedMonth);
  }, [selectedMonth, fetchScores]);

  const winner = scores[0];

  return (
    <div className="min-h-screen bg-[#0A0F1E] text-white">
      {/* Header */}
      <header className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-gradient-to-r from-[#0A0F1E] via-[#0D1730] to-[#0A0F1E]" />
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 50%, rgba(14,165,233,0.3) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(16,185,129,0.3) 0%, transparent 50%)',
          }}
        />
        <div className="relative max-w-5xl mx-auto px-4 py-8 text-center">
          <div className="inline-flex items-center gap-2 bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-semibold px-3 py-1 rounded-full mb-4 tracking-widest uppercase">
            <Trophy size={12} />
            Power Teams Championship
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-2 bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Monthly Leaderboard
          </h1>
          <p className="text-slate-400 text-sm">
            Compete. Perform. Lead. The trophy is yours to win.
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Month Selector */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(o => !o)}
              className="flex items-center gap-2 bg-white/5 border border-white/10 hover:border-white/20 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            >
              <span>{months.includes(selectedMonth) ? monthIdToLabel(selectedMonth) : 'Select month'}</span>
              <ChevronDown size={14} className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {dropdownOpen && months.length > 0 && (
              <div className="absolute top-full mt-2 left-0 z-10 bg-[#131929] border border-white/10 rounded-xl shadow-2xl min-w-[220px] py-1 overflow-hidden">
                {months.map(month => (
                  <button
                    key={month}
                    onClick={() => { setSelectedMonth(month); setDropdownOpen(false); }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-white/5 transition-colors ${
                      month === selectedMonth ? 'text-sky-400 font-semibold' : 'text-slate-300'
                    }`}
                  >
                    {monthIdToLabel(month)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => fetchScores(selectedMonth)}
            className="flex items-center gap-2 text-slate-400 hover:text-white text-xs transition-colors"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>

        {loading ? (
          <LoadingSkeleton />
        ) : scores.length === 0 ? (
          <EmptyState monthLabel={monthIdToLabel(selectedMonth)} />
        ) : (
          <>
            {/* Winner Spotlight */}
            {winner && (
              <WinnerCard score={winner} />
            )}

            {/* Podium Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {scores.map((s, i) => (
                <TeamCard key={s.id} score={s} position={i} />
              ))}
            </div>

            {/* Detailed Breakdown */}
            <ScoreBreakdownTable scores={scores} />

            {/* Category Highlights */}
            <CategoryHighlights scores={scores} />
          </>
        )}
      </main>

      <footer className="text-center text-slate-600 text-xs py-8">
        Power Teams Championship &bull; Updated monthly
      </footer>
    </div>
  );
}

function WinnerCard({ score }: { score: RankedScore }) {
  const team = score.teams;
  const color = team?.color ?? '#3B82F6';
  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-6 text-center"
      style={{ borderColor: color + '40', background: `linear-gradient(135deg, ${color}15 0%, transparent 60%)` }}
    >
      <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style={{ background: color }} />
      <div className="flex flex-col items-center gap-3">
        <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl font-black" style={{ background: color + '20', border: `2px solid ${color}60` }}>
          <Trophy size={28} style={{ color }} />
        </div>
        <div>
          <p className="text-xs text-amber-400 font-semibold tracking-widest uppercase mb-1">Power Team of the Month</p>
          <h2 className="text-3xl font-extrabold" style={{ color }}>{team?.name}</h2>
        </div>
        <div className="flex items-end gap-1">
          <span className="text-5xl font-black text-white">{score.total_points}</span>
          <span className="text-slate-400 mb-2 text-sm">pts</span>
        </div>
      </div>
    </div>
  );
}

function TeamCard({ score, position }: { score: RankedScore; position: number }) {
  const team = score.teams;
  const color = team?.color ?? '#3B82F6';
  const medal = MEDAL_COLORS[position];
  const label = MEDAL_LABELS[position];

  return (
    <div
      className="relative rounded-2xl border p-5 transition-transform hover:-translate-y-1 hover:shadow-xl"
      style={{ borderColor: color + '30', background: `linear-gradient(160deg, ${color}0d 0%, transparent 50%)` }}
    >
      <div className="flex items-start justify-between mb-4">
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ background: medal + '20', color: medal }}
        >
          {label}
        </span>
        <span className="text-2xl font-extrabold text-white">{score.total_points}<span className="text-xs text-slate-500 font-normal ml-1">pts</span></span>
      </div>
      <h3 className="text-lg font-bold mb-4" style={{ color }}>{team?.name}</h3>
      <div className="space-y-2">
        <MiniBar label="Green" pts={score.green_points} max={20} color="#22C55E" />
        <MiniBar label="Business" pts={score.business_points} max={30} color="#F59E0B" />
        <MiniBar label="Visitors" pts={score.visitor_points} max={30} color="#0EA5E9" />
        <MiniBar label="Star" pts={score.star_points} max={20} color="#A855F7" />
      </div>
    </div>
  );
}

function MiniBar({ label, pts, max, color }: { label: string; pts: number; max: number; color: string }) {
  const pct = Math.min((pts / max) * 100, 100);
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-400">{label}</span>
        <span className="text-white font-medium">{pts}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function ScoreBreakdownTable({ scores }: { scores: RankedScore[] }) {
  return (
    <div className="rounded-2xl border border-white/10 overflow-hidden">
      <div className="bg-white/5 px-6 py-3 text-xs font-semibold text-slate-400 tracking-widest uppercase">
        Detailed Score Breakdown
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-slate-500 text-xs">
              <th className="text-left px-6 py-3">Team</th>
              <th className="text-center px-4 py-3">Green %</th>
              <th className="text-center px-4 py-3">Green Pts</th>
              <th className="text-center px-4 py-3">Business</th>
              <th className="text-center px-4 py-3">Biz Pts</th>
              <th className="text-center px-4 py-3">Visitors</th>
              <th className="text-center px-4 py-3">Vis Pts</th>
              <th className="text-center px-4 py-3">Star Pts</th>
              <th className="text-center px-4 py-3 font-bold text-white">Total</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((s, i) => {
              const color = s.teams?.color ?? '#3B82F6';
              return (
                <tr key={s.id} className={`border-b border-white/5 ${i % 2 === 0 ? 'bg-white/[0.02]' : ''}`}>
                  <td className="px-6 py-3 font-semibold" style={{ color }}>{s.teams?.name}</td>
                  <td className="text-center px-4 py-3 text-slate-300">{s.green_score_pct}%</td>
                  <td className="text-center px-4 py-3 text-green-400 font-medium">{s.green_points}</td>
                  <td className="text-center px-4 py-3 text-slate-300">{s.business_amount.toLocaleString()}</td>
                  <td className="text-center px-4 py-3 text-amber-400 font-medium">{s.business_points}</td>
                  <td className="text-center px-4 py-3 text-slate-300">{s.visitor_count.toLocaleString()}</td>
                  <td className="text-center px-4 py-3 text-sky-400 font-medium">{s.visitor_points}</td>
                  <td className="text-center px-4 py-3 text-violet-400 font-medium">{s.star_points}</td>
                  <td className="text-center px-4 py-3 font-extrabold text-white text-base">{s.total_points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CategoryHighlights({ scores }: { scores: RankedScore[] }) {
  if (scores.length === 0) return null;
  const topGreen = [...scores].sort((a, b) => b.green_score_pct - a.green_score_pct)[0];
  const topBiz = [...scores].sort((a, b) => b.business_amount - a.business_amount)[0];
  const topVis = [...scores].sort((a, b) => b.visitor_count - a.visitor_count)[0];
  const topStar = [...scores].sort((a, b) => b.star_points - a.star_points)[0];

  const highlights = [
    { icon: TrendingUp, label: 'Green Score Leader', team: topGreen?.teams?.name, value: `${topGreen?.green_score_pct}%`, color: '#22C55E' },
    { icon: Award, label: 'Business Leader', team: topBiz?.teams?.name, value: topBiz?.business_amount.toLocaleString(), color: '#F59E0B' },
    { icon: Users, label: 'Visitor Leader', team: topVis?.teams?.name, value: topVis?.visitor_count.toLocaleString(), color: '#0EA5E9' },
    { icon: Star, label: 'Star Points Leader', team: topStar?.teams?.name ?? '-', value: topStar ? `${topStar.star_points} pts` : 'Not awarded', color: '#EAB308' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {highlights.map(({ icon: Icon, label, team, value, color }) => (
        <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: color + '20' }}>
              <Icon size={16} style={{ color }} />
            </div>
            <span className="text-xs text-slate-400">{label}</span>
          </div>
          <p className="font-bold text-white text-base leading-tight">{team}</p>
          <p className="text-xs mt-1" style={{ color }}>{value}</p>
        </div>
      ))}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-40 rounded-2xl bg-white/5" />
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-48 rounded-2xl bg-white/5" />)}
      </div>
    </div>
  );
}

function EmptyState({ monthLabel }: { monthLabel: string }) {
  return (
    <div className="text-center py-20">
      <Trophy size={48} className="mx-auto text-slate-700 mb-4" />
      <p className="text-slate-400 font-medium">No scores recorded yet</p>
      <p className="text-slate-600 text-sm mt-1">{monthLabel}</p>
    </div>
  );
}
