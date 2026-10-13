import { useState, useEffect, useRef } from 'react';
import { HostDashboard } from '../components/HostDashboard';
import { useGameSession, ClaimEvent } from '../lib/useGameSession';
import { supabase } from '../lib/supabase';

const CLAIM_LABEL: Record<string, string> = {
  EARLY_FIVE: 'Early 5', FOUR_CORNERS: '4 Corners',
  FIRST_ROW: 'First Row', MIDDLE_ROW: 'Middle Row',
  LAST_ROW: 'Last Row', FULL_HOUSE: 'Full House',
};
const CLAIM_EMOJI: Record<string, string> = {
  EARLY_FIVE: '5️⃣', FOUR_CORNERS: '🔲',
  FIRST_ROW: '1️⃣', MIDDLE_ROW: '🎯',
  LAST_ROW: '🏁', FULL_HOUSE: '🏆',
};

function generatePin(existing: string[]): string {
  let pin: string;
  do { pin = String(Math.floor(10000 + Math.random() * 90000)); }
  while (existing.includes(pin));
  return pin;
}

const STORAGE_KEY = 'tambola:host:sessions';
function loadSessions(): string[] {
  try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) return JSON.parse(raw); } catch {}
  return [];
}
function saveSessions(s: string[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
}
function markSessionActive(pin: string) {
  try { localStorage.setItem(`tambola:session:${pin}`, 'active'); } catch {}
}

const ACTIVE_PIN_KEY = 'tambola:host:activePin';
function loadActivePin(): string | null {
  try { return localStorage.getItem(ACTIVE_PIN_KEY); } catch { return null; }
}
function saveActivePin(pin: string) {
  try { localStorage.setItem(ACTIVE_PIN_KEY, pin); } catch {}
}
function deleteSessionData(pin: string) {
  try {
    localStorage.removeItem(`host:called:${pin}`);
    localStorage.removeItem(`host:claims:${pin}`);
    // Remove all player ticket + marked entries for this pin
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith(`ticket:${pin}-`) || key.startsWith(`marked:${pin}-`))) {
        toRemove.push(key);
      }
    }
    toRemove.forEach(k => localStorage.removeItem(k));
  } catch {}
}

function SessionRow({
  pin, idx, total, isActive,
  onSelect, onDelete,
}: {
  pin: string; idx: number; total: number; isActive: boolean;
  onSelect: () => void; onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [input, setInput] = useState('');
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const openConfirm = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirming(true);
    setInput('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const cancel = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setConfirming(false);
    setInput('');
    setShake(false);
  };

  const tryDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (input === pin) {
      onDelete();
    } else {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setInput('');
      inputRef.current?.focus();
    }
  };

  return (
    <div style={{ marginBottom: 6 }}>
      {/* Row */}
      <div
        onClick={onSelect}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 10px 10px 12px', borderRadius: confirming ? '14px 14px 0 0' : 14,
          cursor: 'pointer',
          background: isActive
            ? 'linear-gradient(135deg,rgba(168,85,247,0.28),rgba(236,72,153,0.18))'
            : 'rgba(255,255,255,0.03)',
          outline: isActive ? '1.5px solid rgba(168,85,247,0.45)' : '1.5px solid rgba(255,255,255,0.04)',
          transition: 'background 0.15s',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 900, fontSize: '0.95rem', letterSpacing: '0.15em', color: isActive ? '#fde68a' : '#d8b4fe' }}>
              {pin}
            </span>
            {idx === 0 && (
              <span style={{ fontSize: '0.55rem', fontWeight: 900, color: '#f9a8d4', letterSpacing: '0.1em', textTransform: 'uppercase' }}>new</span>
            )}
          </div>
          <span style={{ fontSize: '0.62rem', fontWeight: 700, color: isActive ? '#c084fc' : '#4c1d95' }}>
            Game #{total - idx}
          </span>
        </div>

        {/* Delete trigger */}
        <button
          onClick={openConfirm}
          title="Delete session"
          style={{
            flexShrink: 0, width: 28, height: 28,
            borderRadius: 8, border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: confirming ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.1)',
            color: '#f87171', fontSize: '0.85rem',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.28)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = confirming ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.1)'; }}
        >
          🗑
        </button>
      </div>

      {/* Inline confirm panel */}
      {confirming && (
        <div
          style={{
            borderRadius: '0 0 14px 14px',
            background: 'rgba(30,5,30,0.97)',
            border: '1.5px solid rgba(239,68,68,0.35)',
            borderTop: 'none',
            padding: '10px 10px',
            animation: shake ? 'shake 0.4s' : 'none',
          }}
          onClick={e => e.stopPropagation()}
        >
          <p style={{ fontSize: '0.6rem', fontWeight: 900, color: '#fca5a5', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 7 }}>
            Type PIN to confirm delete
          </p>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') tryDelete(e as unknown as React.MouseEvent); if (e.key === 'Escape') cancel(); }}
            placeholder={pin}
            maxLength={5}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '7px 10px', borderRadius: 10,
              background: 'rgba(239,68,68,0.1)',
              border: `1.5px solid ${input && input !== pin.slice(0, input.length) ? 'rgba(239,68,68,0.6)' : 'rgba(239,68,68,0.3)'}`,
              color: '#fde68a', fontWeight: 900, fontSize: '1rem', letterSpacing: '0.2em',
              outline: 'none', fontFamily: 'inherit',
            }}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button
              onClick={tryDelete}
              style={{
                flex: 1, padding: '7px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                fontWeight: 900, fontSize: '0.75rem', color: '#fff',
                background: input === pin ? 'linear-gradient(135deg,#ef4444,#b91c1c)' : 'rgba(239,68,68,0.25)',
                boxShadow: input === pin ? '0 0 12px rgba(239,68,68,0.5)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              Delete
            </button>
            <button
              onClick={cancel}
              style={{
                flex: 1, padding: '7px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                fontWeight: 900, fontSize: '0.75rem',
                color: '#a78bfa', background: 'rgba(139,92,246,0.12)',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%      { transform: translateX(-6px); }
          40%      { transform: translateX(6px); }
          60%      { transform: translateX(-4px); }
          80%      { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
}

export default function HostPage() {
  const [sessions, setSessions] = useState<string[]>([]);
  const [activePin, setActivePin] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [autoRunning, setAutoRunning] = useState(false);
  const autoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const saved = loadSessions();
    const lastActive = loadActivePin();
    if (saved.length > 0) {
      setSessions(saved);
      const pin = lastActive && saved.includes(lastActive) ? lastActive : saved[0];
      setActivePin(pin);
      saved.forEach(p => {
        supabase.from('game_sessions')
          .upsert({ pin: p, called_numbers: [], status: 'active' }, { onConflict: 'pin', ignoreDuplicates: true });
      });
    }
    setIsClient(true);
  }, []);

  const { calledNumbers, lastCalled, callNumber, claims, hintsEnabled, toggleHints, hostDelayMs, playerDelayMs, updateDelays, autoCallMs, updateAutoCallMs } = useGameSession(activePin ?? '');

  const handleCallNumber = () => {
    if (!activePin) return;
    const called = calledNumbers;
    let num: number;
    do { num = Math.floor(Math.random() * 90) + 1; }
    while (called.has(num));
    callNumber(num);
  };

  // Auto-call: fires handleCallNumber on interval, stops when all 90 called
  // Use refs so the interval always sees fresh state without needing to re-register
  const calledNumbersRef = useRef(calledNumbers);
  const autoCallMsRef = useRef(autoCallMs);
  const handleCallNumberRef = useRef(handleCallNumber);
  calledNumbersRef.current = calledNumbers;
  autoCallMsRef.current = autoCallMs;
  handleCallNumberRef.current = handleCallNumber;

  const stopAuto = () => {
    setAutoRunning(false);
    if (autoIntervalRef.current) { clearInterval(autoIntervalRef.current); autoIntervalRef.current = null; }
  };

  const startAuto = () => {
    if (calledNumbersRef.current.size >= 90) return;
    setAutoRunning(true);
    const tick = () => {
      if (calledNumbersRef.current.size >= 90) { stopAuto(); return; }
      handleCallNumberRef.current();
    };
    tick(); // call immediately on start
    autoIntervalRef.current = setInterval(tick, autoCallMsRef.current + hostDelayMs);
  };

  // Stop auto-call when switching sessions or all numbers called
  useEffect(() => {
    stopAuto();
  }, [activePin]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (calledNumbers.size >= 90) stopAuto();
  }, [calledNumbers.size]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep interval in sync with autoCallMs changes
  useEffect(() => {
    if (!autoRunning) return;
    if (autoIntervalRef.current) clearInterval(autoIntervalRef.current);
    autoIntervalRef.current = setInterval(() => {
      if (calledNumbersRef.current.size >= 90) { stopAuto(); return; }
      handleCallNumberRef.current();
    }, autoCallMsRef.current + hostDelayMs);
    return () => { if (autoIntervalRef.current) clearInterval(autoIntervalRef.current); };
  }, [autoCallMs, hostDelayMs]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNewGame = async () => {
    const pin = generatePin(sessions);
    const updated = [pin, ...sessions];
    saveSessions(updated); setSessions(updated); setActivePin(pin); saveActivePin(pin);
    markSessionActive(pin);
    await supabase.from('game_sessions').insert({ pin, called_numbers: [], status: 'active', hints_enabled: true, host_delay_ms: 2000, player_delay_ms: 3000, auto_call_ms: 5000 });
  };

  const handleDelete = async (pin: string) => {
    const updated = sessions.filter(s => s !== pin);
    // Mark deleted first so Realtime notifies players, then clean up after 3s
    await supabase.from('game_sessions').update({ status: 'deleted' }).eq('pin', pin);
    setTimeout(() => {
      supabase.from('game_claims').delete().eq('pin', pin);
      supabase.from('game_sessions').delete().eq('pin', pin);
    }, 5 * 60 * 1000);
    deleteSessionData(pin);
    saveSessions(updated);
    setSessions(updated);
    if (activePin === pin) {
      const next = updated[0] ?? null;
      setActivePin(next);
      if (next) saveActivePin(next);
      else try { localStorage.removeItem(ACTIVE_PIN_KEY); } catch {}
    }
    if (updated.length === 0) {
      setActivePin(null);
      try { localStorage.removeItem(ACTIVE_PIN_KEY); } catch {}
    }
  };

  if (!isClient) {
    return (
      <div style={{ minHeight: '100vh', background: '#07030f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', border: '4px solid #a855f7', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#07030f', color: '#fff', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ── */}
      <header style={{
        background: 'linear-gradient(135deg,#1e0a3c,#2d0f5a,#1e0a3c)',
        borderBottom: '1.5px solid rgba(167,139,250,0.2)',
        padding: '12px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontWeight: 900, fontSize: '1.2rem', letterSpacing: '0.12em',
            background: 'linear-gradient(90deg,#facc15,#f97316)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>TAMBOLA</span>
          <span style={{
            fontSize: '0.65rem', fontWeight: 900, letterSpacing: '0.2em',
            color: '#c084fc', background: 'rgba(139,92,246,0.2)',
            border: '1px solid rgba(139,92,246,0.3)',
            borderRadius: 8, padding: '2px 8px', textTransform: 'uppercase',
          }}>Host</span>
        </div>
        {activePin && (
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#a78bfa' }}>
            Active:&nbsp;<span style={{ color: '#fde68a', letterSpacing: '0.15em', fontWeight: 900 }}>{activePin}</span>
          </span>
        )}
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Sidebar ── */}
        <aside style={{
          width: 220, flexShrink: 0,
          background: 'linear-gradient(180deg,#0f0522,#0a0318)',
          borderRight: '1.5px solid rgba(139,92,246,0.15)',
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto',
        }}>
          {/* New game button */}
          <div style={{ padding: '12px 10px', borderBottom: '1px solid rgba(139,92,246,0.15)', flexShrink: 0 }}>
            <button
              onClick={handleNewGame}
              style={{
                width: '100%', padding: '11px 0',
                borderRadius: 16, border: 'none', cursor: 'pointer',
                fontWeight: 900, fontSize: '0.85rem', color: '#fff',
                background: 'linear-gradient(135deg,#ec4899,#8b5cf6)',
                boxShadow: '0 4px 18px rgba(236,72,153,0.4)',
              }}
              onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.96)'; }}
              onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
            >
              ＋ New Game
            </button>
          </div>

          {/* Sessions list */}
          <div style={{ padding: '8px 8px', borderBottom: '1px solid rgba(139,92,246,0.1)' }}>
            <p style={{ fontSize: '0.58rem', fontWeight: 900, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.25em', padding: '6px 8px 8px' }}>
              Sessions
            </p>
            {sessions.map((pin, idx) => (
              <SessionRow
                key={pin}
                pin={pin}
                idx={idx}
                total={sessions.length}
                isActive={pin === activePin}
                onSelect={() => { setActivePin(pin); saveActivePin(pin); }}
                onDelete={() => handleDelete(pin)}
              />
            ))}
          </div>

          {/* Auto-call */}
          {activePin && (
            <div style={{ padding: '10px 10px', borderBottom: '1px solid rgba(139,92,246,0.1)' }}>
              <p style={{ fontSize: '0.58rem', fontWeight: 900, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.25em', padding: '0 4px 6px' }}>
                Auto Call
              </p>
              {/* Interval stepper */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <button
                  onClick={() => updateAutoCallMs(Math.max(3000, autoCallMs - 1000))}
                  disabled={autoCallMs <= 3000 || autoRunning}
                  style={{
                    width: 28, height: 28, borderRadius: 8, border: 'none',
                    cursor: autoCallMs <= 3000 || autoRunning ? 'not-allowed' : 'pointer',
                    fontWeight: 900, fontSize: '1rem',
                    color: autoCallMs <= 3000 || autoRunning ? '#4c1d95' : '#c084fc',
                    background: 'rgba(139,92,246,0.15)', flexShrink: 0,
                  }}
                >−</button>
                <div style={{
                  flex: 1, textAlign: 'center', fontWeight: 900, fontSize: '0.85rem',
                  color: '#fde68a', background: 'rgba(139,92,246,0.1)',
                  borderRadius: 8, padding: '4px 0',
                }}>
                  every {autoCallMs / 1000}s
                </div>
                <button
                  onClick={() => updateAutoCallMs(Math.min(30000, autoCallMs + 1000))}
                  disabled={autoCallMs >= 30000 || autoRunning}
                  style={{
                    width: 28, height: 28, borderRadius: 8, border: 'none',
                    cursor: autoCallMs >= 30000 || autoRunning ? 'not-allowed' : 'pointer',
                    fontWeight: 900, fontSize: '1rem',
                    color: autoCallMs >= 30000 || autoRunning ? '#4c1d95' : '#c084fc',
                    background: 'rgba(139,92,246,0.15)', flexShrink: 0,
                  }}
                >+</button>
              </div>
              {/* Start / Stop button */}
              <button
                onClick={autoRunning ? stopAuto : startAuto}
                disabled={calledNumbers.size >= 90}
                style={{
                  width: '100%', padding: '9px 0', borderRadius: 12, border: 'none',
                  cursor: calledNumbers.size >= 90 ? 'not-allowed' : 'pointer',
                  fontWeight: 900, fontSize: '0.8rem', color: '#fff',
                  background: calledNumbers.size >= 90
                    ? 'rgba(55,65,81,0.6)'
                    : autoRunning
                    ? 'linear-gradient(135deg,#ef4444,#b91c1c)'
                    : 'linear-gradient(135deg,#4ade80,#16a34a)',
                  boxShadow: autoRunning ? '0 0 14px rgba(239,68,68,0.5)' : calledNumbers.size < 90 ? '0 0 14px rgba(74,222,128,0.4)' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                {calledNumbers.size >= 90 ? '🎊 All Called!' : autoRunning ? '⏹ Stop Auto' : '▶ Start Auto'}
              </button>
              {autoRunning && (
                <p style={{ fontSize: '0.6rem', color: '#4ade80', padding: '5px 4px 0', fontWeight: 700, textAlign: 'center' }}>
                  Next call in ~{autoCallMs / 1000 + hostDelayMs / 1000}s
                </p>
              )}
            </div>
          )}

          {/* Hints toggle */}
          {activePin && (
            <div style={{ padding: '10px 10px', borderBottom: '1px solid rgba(139,92,246,0.1)' }}>
              <p style={{ fontSize: '0.58rem', fontWeight: 900, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.25em', padding: '0 4px 6px' }}>
                Player Hints
              </p>
              <button
                onClick={toggleHints}
                style={{
                  width: '100%', padding: '8px 10px',
                  borderRadius: 12, border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: hintsEnabled
                    ? 'linear-gradient(135deg,rgba(74,222,128,0.18),rgba(16,163,74,0.12))'
                    : 'rgba(255,255,255,0.04)',
                  outline: hintsEnabled ? '1.5px solid rgba(74,222,128,0.35)' : '1.5px solid rgba(255,255,255,0.06)',
                  transition: 'all 0.2s',
                }}
              >
                <span style={{ fontSize: '0.75rem', fontWeight: 900, color: hintsEnabled ? '#4ade80' : '#6d28d9' }}>
                  {hintsEnabled ? '✨ Hints ON' : '🚫 Hints OFF'}
                </span>
                <div style={{
                  width: 32, height: 18, borderRadius: 999,
                  background: hintsEnabled ? '#4ade80' : 'rgba(109,40,217,0.4)',
                  position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                }}>
                  <div style={{
                    position: 'absolute', top: 3, width: 12, height: 12, borderRadius: '50%',
                    background: '#fff',
                    left: hintsEnabled ? 17 : 3,
                    transition: 'left 0.2s',
                  }} />
                </div>
              </button>
              <p style={{ fontSize: '0.6rem', color: '#4c1d95', padding: '5px 4px 0', lineHeight: 1.4 }}>
                {hintsEnabled ? 'Players see flash + banner when their number is called' : 'Players see no highlights or banners'}
              </p>
            </div>
          )}

          {/* Delay controls */}
          {activePin && (
            <div style={{ padding: '10px 10px', borderBottom: '1px solid rgba(139,92,246,0.1)' }}>
              <p style={{ fontSize: '0.58rem', fontWeight: 900, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.25em', padding: '0 4px 8px' }}>
                Reveal Timing
              </p>
              {([
                { label: '🥁 Host drum-roll', ms: hostDelayMs, onChange: (v: number) => updateDelays(v, playerDelayMs) },
                { label: '👥 Player delay', ms: playerDelayMs, onChange: (v: number) => updateDelays(hostDelayMs, v) },
              ] as { label: string; ms: number; onChange: (v: number) => void }[]).map(({ label, ms, onChange }) => (
                <div key={label} style={{ marginBottom: 8 }}>
                  <p style={{ fontSize: '0.62rem', fontWeight: 700, color: '#a78bfa', padding: '0 2px 4px' }}>{label}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      onClick={() => onChange(Math.max(1000, ms - 1000))}
                      disabled={ms <= 1000}
                      style={{
                        width: 28, height: 28, borderRadius: 8, border: 'none', cursor: ms <= 1000 ? 'not-allowed' : 'pointer',
                        fontWeight: 900, fontSize: '1rem', color: ms <= 1000 ? '#4c1d95' : '#c084fc',
                        background: 'rgba(139,92,246,0.15)', flexShrink: 0,
                      }}
                    >−</button>
                    <div style={{
                      flex: 1, textAlign: 'center', fontWeight: 900, fontSize: '0.9rem',
                      color: '#fde68a', background: 'rgba(139,92,246,0.1)',
                      borderRadius: 8, padding: '4px 0',
                    }}>
                      {ms / 1000}s
                    </div>
                    <button
                      onClick={() => onChange(Math.min(10000, ms + 1000))}
                      disabled={ms >= 10000}
                      style={{
                        width: 28, height: 28, borderRadius: 8, border: 'none', cursor: ms >= 10000 ? 'not-allowed' : 'pointer',
                        fontWeight: 900, fontSize: '1rem', color: ms >= 10000 ? '#4c1d95' : '#c084fc',
                        background: 'rgba(139,92,246,0.15)', flexShrink: 0,
                      }}
                    >+</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Claims feed */}
          <div style={{ padding: '10px 10px', flex: 1 }}>
            <p style={{ fontSize: '0.58rem', fontWeight: 900, color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.25em', padding: '4px 4px 8px' }}>
              🏅 Claims
            </p>
            {claims.length === 0 ? (
              <p style={{ fontSize: '0.72rem', color: '#4c1d95', fontWeight: 700, padding: '0 4px' }}>No claims yet…</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[...claims].reverse().map((c, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 7,
                    padding: '7px 9px', borderRadius: 12,
                    background: 'linear-gradient(135deg,rgba(168,85,247,0.16),rgba(236,72,153,0.1))',
                    border: '1px solid rgba(168,85,247,0.2)',
                  }}>
                    <span style={{ fontSize: '1rem', lineHeight: 1, flexShrink: 0, marginTop: 1 }}>{CLAIM_EMOJI[c.claimType] ?? '🎉'}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 900, fontSize: '0.75rem', color: '#fde68a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.playerName}</div>
                      <div style={{ fontSize: '0.65rem', color: '#c084fc' }}>{CLAIM_LABEL[c.claimType] ?? c.claimType}</div>
                    </div>
                    {i === 0 && (
                      <span style={{
                        flexShrink: 0, fontSize: '0.5rem', fontWeight: 900, color: '#030712',
                        background: 'linear-gradient(135deg,#facc15,#f97316)',
                        padding: '1px 5px', borderRadius: 6, textTransform: 'uppercase', alignSelf: 'center',
                      }}>new</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* ── Main ── */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '20px 16px' }}>
          {activePin ? (
            <HostDashboard key={activePin} pin={activePin} calledNumbers={calledNumbers} lastNumber={lastCalled} onCallNumber={handleCallNumber} drumRollMs={hostDelayMs} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
              <p style={{ fontSize: '2rem' }}>🎲</p>
              <p style={{ fontWeight: 900, fontSize: '1rem', color: '#7c3aed' }}>No sessions yet</p>
              <p style={{ fontSize: '0.8rem', color: '#4c1d95' }}>Click <strong style={{ color: '#ec4899' }}>＋ New Game</strong> to start one</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
