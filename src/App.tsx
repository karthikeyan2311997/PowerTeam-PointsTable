import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import Leaderboard from './pages/Leaderboard';
import AdminLogin from './pages/AdminLogin';
import AdminScoreEntry from './pages/AdminScoreEntry';
import type { Session } from '@supabase/supabase-js';

type View = 'leaderboard' | 'admin';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [view, setView] = useState<View>('leaderboard');
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthChecked(true);
    });

    supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
  }, []);

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#0A0F1E] flex items-center justify-center">
        <span className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      {/* View switcher tab bar */}
      <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-3 pointer-events-none">
        <div className="pointer-events-auto flex gap-1 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-1 shadow-2xl">
          <TabBtn
            active={view === 'leaderboard'}
            onClick={() => setView('leaderboard')}
            label="Leaderboard"
          />
          <TabBtn
            active={view === 'admin'}
            onClick={() => setView('admin')}
            label="Management"
          />
        </div>
      </div>

      {/* Page content with top padding for the tab bar */}
      <div className="pt-14">
        {view === 'leaderboard' && <Leaderboard />}
        {view === 'admin' && (
          session
            ? <AdminScoreEntry onLogout={() => setView('leaderboard')} />
            : <AdminLogin onLogin={() => {}} />
        )}
      </div>
    </>
  );
}

function TabBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-1.5 rounded-xl text-sm font-semibold transition-all ${
        active
          ? 'bg-white text-[#0A0F1E] shadow'
          : 'text-slate-400 hover:text-white'
      }`}
    >
      {label}
    </button>
  );
}

export default App;
