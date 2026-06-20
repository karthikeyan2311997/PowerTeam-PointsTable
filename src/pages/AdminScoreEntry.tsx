import { useEffect, useState, useCallback } from 'react';
import {
  LogOut, Trophy, Plus, Save, ChevronDown, CheckCircle2, AlertCircle, Settings
} from 'lucide-react';
import {
  supabase, Team, MonthlyScore, ScoreInput, computePoints, getMonthId, monthIdToLabel
} from '../lib/supabase';

type Props = { onLogout: () => void };

type FormRow = {
  team_id: string;
  green_score_pct: string;
  business_amount: string;
  visitor_count: string;
  star_rank: string;
};

const STAR_RANKS = [
  { value: '0', label: 'Not ranked' },
  { value: '1', label: '#1 – 30 pts' },
  { value: '2', label: '#2 – 15 pts' },
  { value: '3', label: '#3 – 5 pts' },
  { value: '4', label: '#4 – 0 pts' },
];

function generateMonthOptions(): string[] {
  const months: string[] = [];
  const current = getMonthId();
  months.push(current);
  // Add 12 past months
  for (let i = 1; i <= 12; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const monthId = getMonthId(d);
    if (!months.includes(monthId)) months.push(monthId);
  }
  return months;
}

export default function AdminScoreEntry({ onLogout }: Props) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(getMonthId());
  const [monthOptions] = useState<string[]>(generateMonthOptions);
  const [monthDropdown, setMonthDropdown] = useState(false);
  const [rows, setRows] = useState<FormRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [existingScores, setExistingScores] = useState<MonthlyScore[]>([]);
  const [preview, setPreview] = useState<ReturnType<typeof computePoints>>([]);

  const fetchTeams = useCallback(async () => {
    const { data } = await supabase.from('teams').select('*').order('name');
    if (data) setTeams(data);
  }, []);

  const fetchExisting = useCallback(async (monthId: string) => {
    const { data } = await supabase
      .from('monthly_scores')
      .select('*')
      .eq('month_id', monthId);
    setExistingScores(data ?? []);
    return data ?? [];
  }, []);

  const initRows = useCallback((teamList: Team[], existing: MonthlyScore[]) => {
    const rows: FormRow[] = teamList.map(t => {
      const ex = existing.find(e => e.team_id === t.id);
      return {
        team_id: t.id,
        green_score_pct: ex ? String(ex.green_score_pct) : '',
        business_amount: ex ? String(ex.business_amount) : '',
        visitor_count: ex ? String(ex.visitor_count) : '',
        star_rank: ex ? String(ex.star_rank) : '0',
      };
    });
    setRows(rows);
  }, []);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  useEffect(() => {
    if (teams.length === 0) return;
    fetchExisting(selectedMonth).then(existing => {
      initRows(teams, existing);
    });
  }, [selectedMonth, teams, fetchExisting, initRows]);

  useEffect(() => {
    if (rows.length < 4) return;
    const filled = rows.filter(r => r.green_score_pct !== '' && r.business_amount !== '' && r.visitor_count !== '');
    if (filled.length === 4) {
      const inputs: ScoreInput[] = rows.map(r => ({
        week_id: selectedMonth,
        team_id: r.team_id,
        green_score_pct: parseFloat(r.green_score_pct) || 0,
        business_amount: parseFloat(r.business_amount) || 0,
        visitor_count: parseInt(r.visitor_count) || 0,
        star_rank: parseInt(r.star_rank) || 0,
      }));
      setPreview(computePoints(inputs));
    } else {
      setPreview([]);
    }
  }, [rows, selectedMonth]);

  const updateRow = (idx: number, field: keyof FormRow, value: string) => {
    setRows(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const handleSave = async () => {
    const errors: string[] = [];
    for (const r of rows) {
      if (r.green_score_pct === '' || r.business_amount === '' || r.visitor_count === '') {
        errors.push('All fields are required for every team.');
        break;
      }
      if (parseFloat(r.green_score_pct) < 0 || parseFloat(r.green_score_pct) > 100) {
        errors.push('Green score must be between 0 and 100.');
        break;
      }
    }
    if (errors.length > 0) {
      setStatus({ type: 'error', message: errors[0] });
      return;
    }

    // Validate star ranks: each rank 1-4 used at most once
    const starRanks = rows.map(r => parseInt(r.star_rank)).filter(n => n > 0);
    const uniqueRanks = new Set(starRanks);
    if (starRanks.length !== uniqueRanks.size) {
      setStatus({ type: 'error', message: 'Each Star of the Month rank (1-4) can only be assigned once.' });
      return;
    }

    setSaving(true);
    setStatus(null);

    const inputs: ScoreInput[] = rows.map(r => ({
      week_id: selectedMonth,
      team_id: r.team_id,
      green_score_pct: parseFloat(r.green_score_pct),
      business_amount: parseFloat(r.business_amount),
      visitor_count: parseInt(r.visitor_count),
      star_rank: parseInt(r.star_rank),
    }));

    const computed = computePoints(inputs);

    const upserts = computed.map(c => ({
      week_id: c.week_id,
      team_id: c.team_id,
      green_score_pct: c.green_score_pct,
      business_amount: c.business_amount,
      visitor_count: c.visitor_count,
      star_rank: c.star_rank,
      green_points: c.green_points,
      business_points: c.business_points,
      visitor_points: c.visitor_points,
      star_points: c.star_points,
      total_points: c.total_points,
    }));

    const { error } = await supabase.from('monthly_scores').upsert(upserts, {
      onConflict: 'month_id,team_id',
    });

    setSaving(false);

    if (error) {
      setStatus({ type: 'error', message: error.message });
    } else {
      setStatus({ type: 'success', message: `Scores saved for ${monthIdToLabel(selectedMonth)}!` });
      fetchExisting(selectedMonth);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onLogout();
  };

  const teamColor = (id: string) => teams.find(t => t.id === id)?.color ?? '#3B82F6';
  const teamName = (id: string) => teams.find(t => t.id === id)?.name ?? '';

  return (
    <div className="min-h-screen bg-[#0A0F1E] text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#0D1220]">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Trophy size={18} className="text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Power Teams Championship</p>
              <h1 className="font-bold text-white text-sm flex items-center gap-1">
                <Settings size={12} /> Score Management
              </h1>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Month Selector */}
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <label className="block text-xs text-slate-500 mb-1 uppercase tracking-wide">Month</label>
            <div className="relative">
              <button
                onClick={() => setMonthDropdown(o => !o)}
                className="flex items-center gap-2 bg-white/5 border border-white/10 hover:border-white/20 px-4 py-2 rounded-xl text-sm font-medium text-white transition-colors min-w-[220px]"
              >
                <span className="flex-1 text-left">{monthIdToLabel(selectedMonth)}</span>
                <ChevronDown size={14} className={`transition-transform ${monthDropdown ? 'rotate-180' : ''}`} />
              </button>
              {monthDropdown && (
                <div className="absolute top-full mt-2 left-0 z-10 bg-[#131929] border border-white/10 rounded-xl shadow-2xl min-w-[220px] py-1 overflow-hidden">
                  {monthOptions.map(month => (
                    <button
                      key={month}
                      onClick={() => { setSelectedMonth(month); setMonthDropdown(false); }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-white/5 transition-colors ${month === selectedMonth ? 'text-sky-400 font-semibold' : 'text-slate-300'}`}
                    >
                      {monthIdToLabel(month)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {existingScores.length > 0 && (
            <div className="flex items-center gap-2 bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs px-3 py-2 rounded-xl mt-5">
              <CheckCircle2 size={12} />
              Existing scores loaded — editing will overwrite
            </div>
          )}
        </div>

        {/* Score Entry Form */}
        {rows.length > 0 && (
          <div className="rounded-2xl border border-white/10 overflow-hidden">
            <div className="bg-white/5 px-6 py-4 flex items-center gap-2">
              <Plus size={16} className="text-slate-400" />
              <span className="font-semibold text-sm">Enter Monthly Scores</span>
            </div>

            <div className="p-6 space-y-4">
              {rows.map((row, i) => {
                const color = teamColor(row.team_id);
                const name = teamName(row.team_id);
                const previewRow = preview.find(p => p.team_id === row.team_id);
                return (
                  <div
                    key={row.team_id}
                    className="rounded-xl border p-5"
                    style={{ borderColor: color + '30', background: color + '08' }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-base" style={{ color }}>{name}</h3>
                      {previewRow && (
                        <span className="text-xs bg-white/5 border border-white/10 px-3 py-1 rounded-full text-slate-300">
                          Preview: <span className="font-bold text-white">{previewRow.total_points} pts</span>
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <FieldInput
                        label="Green Score %"
                        placeholder="0 – 100"
                        value={row.green_score_pct}
                        onChange={v => updateRow(i, 'green_score_pct', v)}
                        type="number"
                        min="0"
                        max="100"
                        hint={previewRow ? `${previewRow.green_points} pts` : undefined}
                        color="#22C55E"
                      />
                      <FieldInput
                        label="Business Generated"
                        placeholder="Amount"
                        value={row.business_amount}
                        onChange={v => updateRow(i, 'business_amount', v)}
                        type="number"
                        min="0"
                        hint={previewRow ? `${previewRow.business_points} pts` : undefined}
                        color="#F59E0B"
                      />
                      <FieldInput
                        label="No. of Visitors"
                        placeholder="Count"
                        value={row.visitor_count}
                        onChange={v => updateRow(i, 'visitor_count', v)}
                        type="number"
                        min="0"
                        hint={previewRow ? `${previewRow.visitor_points} pts` : undefined}
                        color="#0EA5E9"
                      />
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                          Star of the Month
                        </label>
                        <select
                          value={row.star_rank}
                          onChange={e => updateRow(i, 'star_rank', e.target.value)}
                          className="w-full bg-white/5 border border-white/10 focus:border-white/20 focus:outline-none rounded-xl px-3 py-2.5 text-white text-sm transition-colors appearance-none"
                        >
                          {STAR_RANKS.map(r => (
                            <option key={r.value} value={r.value} className="bg-[#131929]">
                              {r.label}
                            </option>
                          ))}
                        </select>
                        {previewRow && (
                          <p className="text-xs mt-1" style={{ color: '#A855F7' }}>
                            {previewRow.star_points} pts
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {status && (
                <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm ${
                  status.type === 'success'
                    ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                    : 'bg-red-500/10 border border-red-500/20 text-red-400'
                }`}>
                  {status.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  {status.message}
                </div>
              )}

              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {saving ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                {saving ? 'Saving…' : 'Save Scores & Compute Points'}
              </button>
            </div>
          </div>
        )}

        {/* Points Preview Table */}
        {preview.length === 4 && (
          <div className="rounded-2xl border border-white/10 overflow-hidden">
            <div className="bg-white/5 px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-widest">
              Points Preview
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-slate-500 text-xs">
                    <th className="text-left px-6 py-3">Team</th>
                    <th className="text-center px-4 py-3">Green</th>
                    <th className="text-center px-4 py-3">Business</th>
                    <th className="text-center px-4 py-3">Visitors</th>
                    <th className="text-center px-4 py-3">Star</th>
                    <th className="text-center px-4 py-3 text-white font-bold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {[...preview].sort((a, b) => b.total_points - a.total_points).map((p, i) => {
                    const color = teamColor(p.team_id);
                    return (
                      <tr key={p.team_id} className={`border-b border-white/5 ${i % 2 === 0 ? 'bg-white/[0.02]' : ''}`}>
                        <td className="px-6 py-3 font-semibold" style={{ color }}>{teamName(p.team_id)}</td>
                        <td className="text-center px-4 py-3 text-green-400">{p.green_points}</td>
                        <td className="text-center px-4 py-3 text-amber-400">{p.business_points}</td>
                        <td className="text-center px-4 py-3 text-sky-400">{p.visitor_points}</td>
                        <td className="text-center px-4 py-3 text-violet-400">{p.star_points}</td>
                        <td className="text-center px-4 py-3 font-extrabold text-white text-base">{p.total_points}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

type FieldInputProps = {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  min?: string;
  max?: string;
  hint?: string;
  color?: string;
};

function FieldInput({ label, placeholder, value, onChange, type = 'text', min, max, hint, color }: FieldInputProps) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
        {label}
      </label>
      <input
        type={type}
        min={min}
        max={max}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-white/5 border border-white/10 focus:border-white/20 focus:outline-none rounded-xl px-3 py-2.5 text-white placeholder-slate-600 text-sm transition-colors"
      />
      {hint && <p className="text-xs mt-1 font-medium" style={{ color }}>{hint}</p>}
    </div>
  );
}
