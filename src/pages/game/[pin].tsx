import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { getTicket, TambolaTicket } from '../../lib/gameLogic';
import { Ticket } from '../../components/Ticket';
import { ClaimsDashboard } from '../../components/ClaimsDashboard';
import { useGameSession } from '../../lib/useGameSession';

function getOrCreateTicket(storageKey: string): TambolaTicket {
  try {
    const saved = localStorage.getItem(`ticket:${storageKey}`);
    if (saved) return JSON.parse(saved);
  } catch {}
  const ticket = getTicket();
  try { localStorage.setItem(`ticket:${storageKey}`, JSON.stringify(ticket)); } catch {}
  return ticket;
}

function loadMarked(storageKey: string): Set<number> {
  try {
    const saved = localStorage.getItem(`marked:${storageKey}`);
    if (saved) return new Set(JSON.parse(saved));
  } catch {}
  return new Set();
}

function saveMarked(storageKey: string, marked: Set<number>) {
  try { localStorage.setItem(`marked:${storageKey}`, JSON.stringify([...marked])); } catch {}
}

export default function GamePage() {
  const router = useRouter();
  const { pin, name } = router.query as { pin?: string; name?: string };
  const [ticket, setTicket] = useState<TambolaTicket | null>(null);
  const [markedNumbers, setMarkedNumbers] = useState<Set<number>>(new Set());
  const [sessionActive, setSessionActive] = useState(true);
  const { calledNumbers, lastCalled, claims, broadcastClaim } = useGameSession(pin || '');
  const storageKey = pin && name ? `${pin}-${name}` : '';

  useEffect(() => {
    if (!storageKey) return;
    setTicket(getOrCreateTicket(storageKey));
    setMarkedNumbers(loadMarked(storageKey));
  }, [storageKey]);

  // Poll session liveness — show "game ended" if host deleted this pin
  useEffect(() => {
    if (!pin) return;
    const check = () => {
      try {
        const marker = localStorage.getItem(`tambola:session:${pin}`);
        // Only show "ended" if host explicitly marked it deleted — missing key = still active
        setSessionActive(marker !== 'deleted');
      } catch {}
    };
    check();
    const id = setInterval(check, 1500);
    return () => clearInterval(id);
  }, [pin]);

  const handleToggle = (num: number) => {
    setMarkedNumbers(prev => {
      const next = new Set(prev);
      if (next.has(num)) { next.delete(num); } else { next.add(num); }
      saveMarked(storageKey, next);
      return next;
    });
  };

  if (!sessionActive) {
    return (
      <div style={{ minHeight: '100vh', background: '#07030f', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
        <span style={{ fontSize: '3rem' }}>🎮</span>
        <p style={{ fontWeight: 900, fontSize: '1.4rem', background: 'linear-gradient(90deg,#f97316,#ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Game Ended
        </p>
        <p style={{ fontSize: '0.85rem', color: '#7c3aed', textAlign: 'center' }}>
          The host has ended session <strong style={{ color: '#fde68a', letterSpacing: '0.1em' }}>{pin}</strong>.<br />Ask the host for a new PIN to join again.
        </p>
        <button
          onClick={() => router.push('/')}
          style={{ marginTop: 8, padding: '12px 28px', borderRadius: 16, border: 'none', cursor: 'pointer', fontWeight: 900, fontSize: '0.9rem', color: '#fff', background: 'linear-gradient(135deg,#8b5cf6,#ec4899)', boxShadow: '0 4px 18px rgba(139,92,246,0.4)' }}
        >
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#07030f', color: '#fff', display: 'flex', flexDirection: 'column' }}>

      {/* ── Top bar ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: 'linear-gradient(135deg, #0f0720 0%, #1a0a35 100%)',
        borderBottom: '1px solid rgba(139,92,246,0.25)',
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <span style={{
          fontWeight: 900, fontSize: '1.1rem', letterSpacing: '0.12em',
          background: 'linear-gradient(90deg,#f97316,#ec4899)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          TAMBOLA
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)',
            borderRadius: 12, padding: '4px 12px',
            fontSize: '0.78rem', fontWeight: 700, color: '#a78bfa',
          }}>
            PIN&nbsp;<span style={{ color: '#facc15', letterSpacing: '0.1em' }}>{pin}</span>
          </div>
          <div style={{
            background: 'rgba(236,72,153,0.15)', border: '1px solid rgba(236,72,153,0.3)',
            borderRadius: 12, padding: '4px 12px',
            fontSize: '0.78rem', fontWeight: 700, color: '#f9a8d4',
            maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {name}
          </div>
        </div>
      </header>

      <main style={{ flex: 1, padding: '16px 16px 80px', maxWidth: 480, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Hero: last called number ── */}
        <div style={{
          borderRadius: 28,
          background: 'linear-gradient(135deg,#1a0533,#2d0a52)',
          border: '1px solid rgba(139,92,246,0.2)',
          padding: '20px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <p style={{ fontSize: '0.62rem', fontWeight: 900, letterSpacing: '0.25em', color: '#7c3aed', textTransform: 'uppercase', marginBottom: 6 }}>
              Last Called
            </p>
            <div style={{
              fontSize: lastCalled ? '5rem' : '4rem',
              fontWeight: 900, lineHeight: 1, fontVariantNumeric: 'tabular-nums',
              background: lastCalled ? 'linear-gradient(135deg,#facc15,#f97316)' : 'linear-gradient(135deg,#4c1d95,#6d28d9)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              filter: lastCalled ? 'drop-shadow(0 0 18px rgba(249,115,22,0.5))' : 'none',
              transition: 'all 0.3s',
            }}>
              {lastCalled ?? '--'}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'conic-gradient(#8b5cf6 0%, #ec4899 ' + Math.round((calledNumbers.size / 90) * 100) + '%, rgba(139,92,246,0.1) ' + Math.round((calledNumbers.size / 90) * 100) + '%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{
                width: 54, height: 54, borderRadius: '50%', background: '#0f0720',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#e9d5ff', lineHeight: 1 }}>{calledNumbers.size}</span>
                <span style={{ fontSize: '0.55rem', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.1em' }}>called</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Ticket ── */}
        <div style={{ borderRadius: 28, padding: 2, background: 'linear-gradient(135deg,#8b5cf6,#ec4899,#f97316)' }}>
          <div style={{ borderRadius: 26, background: '#0e0620', padding: '16px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: '0.6rem', fontWeight: 900, letterSpacing: '0.25em', color: '#a855f7', textTransform: 'uppercase' }}>
                Your Ticket
              </span>
              <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#6d28d9', letterSpacing: '0.1em' }}>
                tap to mark · tap again to unmark
              </span>
            </div>
            {ticket ? (
              <Ticket ticket={ticket} markedNumbers={markedNumbers} onToggle={handleToggle} />
            ) : (
              <div style={{ height: 160, borderRadius: 16, background: 'rgba(88,28,135,0.2)' }} />
            )}
          </div>
        </div>

        {/* ── Claims ── */}
        <ClaimsDashboard
          ticket={ticket ?? []}
          markedNumbers={markedNumbers}
          calledNumbers={calledNumbers}
          playerName={name ?? 'Player'}
          onClaim={broadcastClaim}
          allClaims={claims}
        />

      </main>
    </div>
  );
}
