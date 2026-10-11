import { useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';

export default function JoinPage() {
  const [pin, setPin] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin || !name) return;
    setLoading(true);
    setError('');

    const check = async () => {
      const { data } = await supabase
        .from('game_sessions')
        .select('status')
        .eq('pin', pin.trim())
        .maybeSingle();
      return data;
    };

    let data = await check();
    // Retry once after 2s — host insert may still be in-flight
    if (!data) {
      await new Promise(r => setTimeout(r, 2000));
      data = await check();
    }

    setLoading(false);
    if (!data) {
      setError('No active game found with that PIN. Check with your host.');
      return;
    }
    if (data.status === 'deleted') {
      setError('This game has been closed by the host.');
      return;
    }
    router.push(`/game/${pin.trim()}?name=${encodeURIComponent(name.trim())}`);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#07030f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <form onSubmit={handleJoin} style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <p style={{ fontWeight: 900, fontSize: '2rem', letterSpacing: '0.1em', background: 'linear-gradient(90deg,#facc15,#f97316)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            TAMBOLA
          </p>
          <p style={{ fontSize: '0.85rem', color: '#a78bfa', fontWeight: 700, marginTop: 4 }}>Join the Party 🎉</p>
        </div>

        <input
          type="text"
          placeholder="Your Name"
          value={name}
          onChange={e => { setName(e.target.value); setError(''); }}
          required
          style={{
            padding: '14px 16px', borderRadius: 16, border: '1.5px solid rgba(139,92,246,0.3)',
            background: 'rgba(139,92,246,0.1)', color: '#fff', fontSize: '1rem', fontWeight: 700, outline: 'none',
          }}
        />

        <input
          type="text"
          placeholder="Game PIN"
          value={pin}
          onChange={e => { setPin(e.target.value); setError(''); }}
          maxLength={5}
          required
          style={{
            padding: '14px 16px', borderRadius: 16, border: `1.5px solid ${error ? 'rgba(239,68,68,0.5)' : 'rgba(139,92,246,0.3)'}`,
            background: 'rgba(139,92,246,0.1)', color: '#facc15', fontSize: '1.5rem', fontWeight: 900,
            letterSpacing: '0.3em', textAlign: 'center', outline: 'none',
          }}
        />

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', fontSize: '0.8rem', color: '#fca5a5', fontWeight: 700 }}>
            ❌ {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '16px 0', borderRadius: 20, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 900, fontSize: '1rem', color: '#fff',
            background: 'linear-gradient(135deg,#ec4899,#8b5cf6)',
            boxShadow: '0 6px 28px rgba(139,92,246,0.5)',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Checking PIN...' : '🎲 Enter Game'}
        </button>
      </form>
    </div>
  );
}
