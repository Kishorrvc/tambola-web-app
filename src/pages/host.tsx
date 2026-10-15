import { useState, useEffect, useRef } from 'react';
import { HostDashboard } from '../components/HostDashboard';
import { useGameSession, ClaimEvent } from '../lib/useGameSession';
import { supabase } from '../lib/supabase';
import { CLAIM_POINTS } from '../lib/gameLogic';
import { ClaimToast } from '../components/ClaimToast';
import type { User } from '@supabase/supabase-js';

const CLAIM_LABEL: Record<string, string> = {
  EARLY_FIVE: 'Early 5',    FOUR_CORNERS: '4 Corners',
  FIRST_ROW: 'First Row',   MIDDLE_ROW: 'Middle Row',
  LAST_ROW: 'Last Row',     BLOCK_LEFT: 'Left Block',
  BLOCK_MIDDLE: 'Mid Block', BLOCK_RIGHT: 'Right Block',
  FULL_HOUSE: 'Full House',
};
const CLAIM_EMOJI: Record<string, string> = {
  EARLY_FIVE: '5️⃣', FOUR_CORNERS: '🔲',
  FIRST_ROW: '1️⃣',  MIDDLE_ROW: '🎯',
  LAST_ROW: '🏁',    BLOCK_LEFT: '◀️',
  BLOCK_MIDDLE: '⬛', BLOCK_RIGHT: '▶️',
  FULL_HOUSE: '🏆',
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
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [signingIn, setSigningIn] = useState(false);

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load sessions for this user
  useEffect(() => {
    if (!user) return;
    supabase
      .from('game_sessions')
      .select('pin')
      .eq('host_user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const pins: string[] = data?.map((r: any) => r.pin) ?? [];
        setSessions(pins);
        if (pins.length > 0) setActivePin(pins[0]);
        setIsClient(true);
      });
  }, [user?.id]);

  const { calledNumbers, lastCalled, callNumber, claims, hintsEnabled, toggleHints, hostDelayMs, playerDelayMs, updateDelays, autoCallMs, updateAutoCallMs } = useGameSession(activePin ?? '');

  const calledNumbersRef = useRef(calledNumbers);
  const autoCallMsRef = useRef(autoCallMs);
  const handleCallNumberRef = useRef(() => {});
  calledNumbersRef.current = calledNumbers;
  autoCallMsRef.current = autoCallMs;

  const handleSignIn = async () => {
    setSigningIn(true);
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: 'https://my-tambola.vercel.app/host' },
    });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const autoRunningRef = useRef(false);
  autoRunningRef.current = autoRunning;
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const noSleepVideoRef = useRef<HTMLVideoElement | null>(null);
  const isCallingRef = useRef(false);       // true while a DB write is in-flight
  const lastTickRef = useRef<number>(0);    // timestamp of last successful tick
  const watchdogRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const acquireWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      }
    } catch {}
  };

  const releaseWakeLock = () => {
    try { wakeLockRef.current?.release(); wakeLockRef.current = null; } catch {}
  };

  // Tiny looping video — keeps media session alive, prevents iOS/Android tab throttle.
  // The data URI is a valid 1×1 transparent MP4 (from the nosleep.js library).
  const startNoSleep = () => {
    try {
      if (noSleepVideoRef.current) return;
      const video = document.createElement('video');
      video.setAttribute('playsinline', '');
      video.setAttribute('muted', '');
      video.muted = true;
      video.loop = true;
      video.src = 'data:video/mp4;base64,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';
      video.play().catch(() => {});
      noSleepVideoRef.current = video;
    } catch {}
  };

  const stopNoSleep = () => {
    try {
      noSleepVideoRef.current?.pause();
      noSleepVideoRef.current = null;
    } catch {}
  };

  const stopAuto = () => {
    setAutoRunning(false);
    isCallingRef.current = false;
    if (autoIntervalRef.current) { clearInterval(autoIntervalRef.current); autoIntervalRef.current = null; }
    if (workerRef.current) { workerRef.current.postMessage({ type: 'stop' }); workerRef.current.terminate(); workerRef.current = null; }
    if (watchdogRef.current) { clearInterval(watchdogRef.current); watchdogRef.current = null; }
    releaseWakeLock();
    stopNoSleep();
  };

  const handleCallNumber = async () => {
    if (!activePin) return;
    if (isCallingRef.current) return;
    isCallingRef.current = true;
    let num: number;
    do { num = Math.floor(Math.random() * 90) + 1; }
    while (calledNumbersRef.current.has(num));
    try {
      await Promise.race([
        callNumber(num),
        new Promise<void>((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
      ]);
    } catch {}
    lastTickRef.current = Date.now(); // update AFTER write, so watchdog sees real elapsed time
    isCallingRef.current = false;
  };
  handleCallNumberRef.current = handleCallNumber;

  const startAuto = () => {
    if (calledNumbersRef.current.size >= 90) return;
    setAutoRunning(true);
    acquireWakeLock();
    startNoSleep();
    lastTickRef.current = Date.now();
    handleCallNumberRef.current();
    const intervalMs = autoCallMsRef.current + hostDelayMs;
    const worker = new Worker('/timer-worker.js');
    workerRef.current = worker;
    worker.postMessage({ type: 'start', intervalMs });
    worker.onmessage = () => {
      if (!autoRunningRef.current) return;
      if (calledNumbersRef.current.size >= 90) { stopAuto(); return; }
      handleCallNumberRef.current();
    };
    // Watchdog: if no tick in 2× interval, restart the worker
    if (watchdogRef.current) clearInterval(watchdogRef.current);
    watchdogRef.current = setInterval(() => {
      if (!autoRunningRef.current) return;
      const elapsed = Date.now() - lastTickRef.current;
      if (elapsed > intervalMs * 2 + 2000) {
        // Stall detected — force-clear the lock regardless of in-flight state
        isCallingRef.current = false;
        // Kill and restart the Worker
        if (workerRef.current) { workerRef.current.postMessage({ type: 'stop' }); workerRef.current.terminate(); }
        const newWorker = new Worker('/timer-worker.js');
        workerRef.current = newWorker;
        newWorker.postMessage({ type: 'start', intervalMs: autoCallMsRef.current + hostDelayMs });
        newWorker.onmessage = () => {
          if (!autoRunningRef.current) return;
          if (calledNumbersRef.current.size >= 90) { stopAuto(); return; }
          handleCallNumberRef.current();
        };
        lastTickRef.current = Date.now();
        handleCallNumberRef.current();
      }
    }, 3000);
  };

  // Re-acquire wake lock on visibility restore and fire catch-up call
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && autoRunningRef.current) {
        acquireWakeLock();
        startNoSleep();
        // Force-clear any stale lock and fire immediately — tab was throttled while hidden
        isCallingRef.current = false;
        lastTickRef.current = Date.now();
        handleCallNumberRef.current();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [hostDelayMs]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { stopAuto(); }, [activePin]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (calledNumbers.size >= 90) stopAuto(); }, [calledNumbers.size]); // eslint-disable-line react-hooks/exhaustive-deps
  // Restart worker with new interval when timing settings change mid-run
  useEffect(() => {
    if (!autoRunning || !workerRef.current) return;
    const intervalMs = autoCallMs + hostDelayMs;
    workerRef.current.postMessage({ type: 'start', intervalMs });
    lastTickRef.current = Date.now();
  }, [autoCallMs, hostDelayMs]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNewGame = async () => {
    if (!user) return;
    const pin = generatePin(sessions);
    const updated = [pin, ...sessions];
    setSessions(updated);
    setActivePin(pin);
    await supabase.from('game_sessions').insert({
      pin, host_user_id: user.id,
      called_numbers: [], status: 'active',
      hints_enabled: true, host_delay_ms: 2000, player_delay_ms: 0, auto_call_ms: 3000,
    });
  };

  const handleDelete = async (pin: string) => {
    const updated = sessions.filter(s => s !== pin);
    await supabase.from('game_sessions').update({ status: 'deleted' }).eq('pin', pin);
    setTimeout(() => {
      supabase.from('game_claims').delete().eq('pin', pin);
      supabase.from('game_sessions').delete().eq('pin', pin);
    }, 5 * 60 * 1000);
    setSessions(updated);
    setActivePin(updated[0] ?? null);
  };

  // ── Auth loading ──
  if (user === undefined) {
    return (
      <div style={{ minHeight: '100vh', background: '#07030f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(139,92,246,0.3)', borderTopColor: '#8b5cf6', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Sign-in screen ──
  if (!user) {
    return (
      <div style={{ minHeight: '100vh', background: '#07030f', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>🎱</div>
          <h1 style={{ fontWeight: 900, fontSize: '2rem', letterSpacing: '0.12em', background: 'linear-gradient(90deg,#f97316,#ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
            TAMBOLA
          </h1>
          <p style={{ fontWeight: 700, fontSize: '0.85rem', color: '#7c3aed', marginTop: 6, letterSpacing: '0.1em' }}>Host Dashboard</p>
        </div>
        <div style={{
          borderRadius: 28, background: 'linear-gradient(135deg,#1a0533,#2d0a52)',
          border: '1px solid rgba(139,92,246,0.25)', padding: '32px 36px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
          maxWidth: 340, width: '100%',
        }}>
          <p style={{ fontSize: '0.88rem', color: '#c4b5fd', textAlign: 'center', lineHeight: 1.5 }}>
            Sign in to manage your Tambola games
          </p>
          <button
            onClick={handleSignIn}
            disabled={signingIn}
            style={{
              width: '100%', padding: '13px 20px', borderRadius: 16, border: 'none',
              cursor: signingIn ? 'wait' : 'pointer', fontWeight: 900, fontSize: '0.95rem', color: '#1a0533',
              background: signingIn ? 'rgba(255,255,255,0.5)' : '#ffffff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              boxShadow: '0 4px 20px rgba(139,92,246,0.3)', opacity: signingIn ? 0.7 : 1,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
              <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.6 32.9 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.5 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.7 18.9 12 24 12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.5 29.6 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 44c5.5 0 10.4-2.1 14.2-5.4l-6.6-5.6C29.8 35 27 36 24 36c-5.2 0-9.6-3.1-11.3-7.5l-6.6 5.1C9.6 39.5 16.3 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.6l6.6 5.6C42 35.5 44 30.1 44 24c0-1.3-.1-2.6-.4-3.9z"/>
            </svg>
            {signingIn ? 'Redirecting…' : 'Sign in with Google'}
          </button>
        </div>
      </div>
    );
  }

  // ── Sessions loading ──
  if (!isClient) {
    return (
      <div style={{ minHeight: '100vh', background: '#07030f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', border: '4px solid #a855f7', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          {user.user_metadata?.avatar_url && (
            <img src={user.user_metadata.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid rgba(139,92,246,0.4)', flexShrink: 0 }} />
          )}
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#c084fc', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.user_metadata?.full_name ?? user.email}
          </span>
          <button
            onClick={handleSignOut}
            style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.35)', cursor: 'pointer', fontWeight: 700, fontSize: '0.65rem', color: '#f87171', background: 'rgba(239,68,68,0.1)', whiteSpace: 'nowrap' }}
          >
            Sign out
          </button>
        </div>
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
                onSelect={() => { setActivePin(pin); }}
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
                  onClick={() => updateAutoCallMs(Math.max(2000, autoCallMs - 1000))}
                  disabled={autoCallMs <= 2000 || autoRunning}
                  style={{
                    width: 28, height: 28, borderRadius: 8, border: 'none',
                    cursor: autoCallMs <= 2000 || autoRunning ? 'not-allowed' : 'pointer',
                    fontWeight: 900, fontSize: '1rem',
                    color: autoCallMs <= 2000 || autoRunning ? '#4c1d95' : '#c084fc',
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
                      onClick={() => onChange(Math.max(label.includes('Player') ? 0 : 1000, ms - 1000))}
                      disabled={ms <= (label.includes('Player') ? 0 : 1000)}
                      style={{
                        width: 28, height: 28, borderRadius: 8, border: 'none',
                        cursor: ms <= (label.includes('Player') ? 0 : 1000) ? 'not-allowed' : 'pointer',
                        fontWeight: 900, fontSize: '1rem',
                        color: ms <= (label.includes('Player') ? 0 : 1000) ? '#4c1d95' : '#c084fc',
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

          {/* Winners summary */}
          {(() => {
            const seen = new Set<string>();
            const uniqueClaims = claims.filter(c => {
              const key = `${c.playerName}:${c.claimType}`;
              if (seen.has(key)) return false;
              seen.add(key); return true;
            });
            const globalWinner: Record<string, string> = {};
            uniqueClaims.forEach(c => { if (!globalWinner[c.claimType]) globalWinner[c.claimType] = c.playerName; });
            const claimOrder = ['EARLY_FIVE','FULL_HOUSE','FOUR_CORNERS','FIRST_ROW','MIDDLE_ROW','LAST_ROW','BLOCK_LEFT','BLOCK_MIDDLE','BLOCK_RIGHT'];
            const claimed = claimOrder.filter(t => globalWinner[t]);
            if (claimed.length === 0) return null;
            return (
              <div style={{ padding: '0 10px 8px' }}>
                <p style={{ fontSize: '0.58rem', fontWeight: 900, color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.25em', paddingBottom: 8 }}>
                  🏆 Winners
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {claimed.map(type => (
                    <div key={type} style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '5px 8px', borderRadius: 10,
                      background: 'linear-gradient(135deg,rgba(250,204,21,0.1),rgba(249,115,22,0.07))',
                      border: '1px solid rgba(250,204,21,0.25)',
                    }}>
                      <span style={{ fontSize: '0.9rem', lineHeight: 1, flexShrink: 0 }}>{CLAIM_EMOJI[type] ?? '🎉'}</span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 900, fontSize: '0.7rem', color: '#facc15', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{globalWinner[type]}</div>
                        <div style={{ fontSize: '0.58rem', color: '#a78bfa' }}>{CLAIM_LABEL[type] ?? type} · {(CLAIM_POINTS as Record<string, number>)[type] ?? 0} pts</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Scoreboard */}
          {(() => {
            const seen = new Set<string>();
            const uniqueClaims = claims.filter(c => {
              const key = `${c.playerName}:${c.claimType}`;
              if (seen.has(key)) return false;
              seen.add(key); return true;
            });
            const globalWinner: Record<string, string> = {};
            uniqueClaims.forEach(c => { if (!globalWinner[c.claimType]) globalWinner[c.claimType] = c.playerName; });
            const scoreMap: Record<string, number> = {};
            uniqueClaims.forEach(c => {
              if (!scoreMap[c.playerName]) scoreMap[c.playerName] = 0;
              if (globalWinner[c.claimType] === c.playerName)
                scoreMap[c.playerName] += (CLAIM_POINTS as Record<string, number>)[c.claimType] ?? 0;
            });
            const scoreboard = Object.entries(scoreMap).sort((a, b) => b[1] - a[1]);
            const total = scoreboard.reduce((s, [, p]) => s + p, 0);
            if (scoreboard.length === 0) return null;
            return (
              <div style={{ padding: '0 10px 8px' }}>
                <p style={{ fontSize: '0.58rem', fontWeight: 900, color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.25em', paddingBottom: 8 }}>
                  🏅 Scores
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {scoreboard.map(([player, pts], i) => {
                    const pct = total > 0 ? Math.round((pts / total) * 100) : 0;
                    return (
                      <div key={player}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 900, color: i === 0 ? '#fde68a' : '#d8b4fe', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>
                            {i === 0 ? '👑 ' : ''}{player}
                          </span>
                          <span style={{ fontSize: '0.68rem', fontWeight: 900, color: '#4ade80', flexShrink: 0, marginLeft: 4 }}>{pts}pt · {pct}%</span>
                        </div>
                        <div style={{ width: '100%', height: 4, borderRadius: 999, background: 'rgba(88,28,135,0.3)' }}>
                          <div style={{ height: 4, borderRadius: 999, width: `${pct}%`, transition: 'width 0.5s', background: i === 0 ? 'linear-gradient(90deg,#facc15,#f97316)' : 'linear-gradient(90deg,#a855f7,#ec4899)' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Claims feed */}
          <div style={{ padding: '0 10px 10px', flex: 1 }}>
            <p style={{ fontSize: '0.58rem', fontWeight: 900, color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.25em', padding: '4px 4px 8px' }}>
              📋 Feed
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
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 900, fontSize: '0.75rem', color: '#fde68a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.playerName}</div>
                      <div style={{ fontSize: '0.65rem', color: '#c084fc' }}>{CLAIM_LABEL[c.claimType] ?? c.claimType}</div>
                    </div>
                    <span style={{ flexShrink: 0, fontSize: '0.65rem', fontWeight: 900, color: '#4ade80', alignSelf: 'center' }}>
                      +{(CLAIM_POINTS as Record<string, number>)[c.claimType] ?? 0}
                    </span>
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
          <ClaimToast claims={claims} />
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
