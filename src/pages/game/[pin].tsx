import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { getTicket, TambolaTicket, validateClaim, ClaimType } from '../../lib/gameLogic';
import { Ticket } from '../../components/Ticket';
import { ClaimsDashboard } from '../../components/ClaimsDashboard';
import { useGameSession } from '../../lib/useGameSession';
import { supabase } from '../../lib/supabase';

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
  const { calledNumbers, lastCalled, claims, broadcastClaim, hintsEnabled, playerDelayMs } = useGameSession(pin || '');
  const [displayedLastCalled, setDisplayedLastCalled] = useState<number | null>(null);
  const [displayedCalledCount, setDisplayedCalledCount] = useState(0);
  const [displayedRecentNumbers, setDisplayedRecentNumbers] = useState<number[]>([]);
  const [nudge, setNudge] = useState<{ num: number; row: number } | null>(null); // used for landscape pulse animation only
  // Status bar: shows nudge or latest claim — persists until overridden
  const [statusMode, setStatusMode] = useState<'idle' | 'nudge' | 'claim'>('idle');
  const [statusClaim, setStatusClaim] = useState<{ playerName: string; claimType: string } | null>(null);
  // Persisted nudge text — survives after nudge pulse ends
  const [lastNudge, setLastNudge] = useState<{ num: number; row: number } | null>(null);
  const storageKey = pin && name ? `${pin}-${name}` : '';

  // Delay showing last called + count by playerDelayMs
  useEffect(() => {
    if (lastCalled === null) return;
    const t = setTimeout(() => {
      setDisplayedLastCalled(lastCalled);
      setDisplayedCalledCount(calledNumbers.size);
      setDisplayedRecentNumbers(prev => {
        const next = [lastCalled, ...prev.filter(n => n !== lastCalled)].slice(0, 5);
        return next;
      });
    }, playerDelayMs);
    return () => clearTimeout(t);
  }, [lastCalled, calledNumbers.size, playerDelayMs]);

  // Show nudge when displayed number lands on ticket — status bar persists after nudge fades
  useEffect(() => {
    if (!displayedLastCalled || !ticket) return;
    let foundRow = -1;
    ticket.forEach((row, ri) => {
      if (row.includes(displayedLastCalled)) foundRow = ri;
    });
    if (foundRow === -1) return;
    const hit = { num: displayedLastCalled, row: foundRow + 1 };
    setNudge(hit);
    setLastNudge(hit);
    setStatusMode('nudge');
    setStatusClaim(null); // nudge takes priority over stale claim
    // nudge state clears after 3s (used only for landscape sidebar pulse)
    // statusMode stays 'nudge' — the bar keeps showing the row hint persistently
    const t = setTimeout(() => setNudge(null), 3000);
    return () => clearTimeout(t);
  }, [displayedLastCalled, ticket]);

  // Update status bar when a new claim arrives
  useEffect(() => {
    if (claims.length === 0) return;
    const latest = claims[claims.length - 1];
    setStatusClaim({ playerName: latest.playerName, claimType: latest.claimType });
    setStatusMode('claim');
  }, [claims.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!storageKey) return;
    setTicket(getOrCreateTicket(storageKey));
    setMarkedNumbers(loadMarked(storageKey));
  }, [storageKey]);

  // Subscribe to session status — show "Game Closed" when host deletes the session
  useEffect(() => {
    if (!pin) return;
    // Check current status
    supabase.from('game_sessions').select('status').eq('pin', pin).maybeSingle()
      .then(({ data }) => { if (data?.status === 'deleted') setSessionActive(false); });
    // Subscribe to updates
    const sub = supabase.channel(`status-${pin}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'game_sessions', filter: `pin=eq.${pin}` },
        (payload) => { if ((payload.new as any).status === 'deleted') setSessionActive(false); }
      )
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [pin]);

  const handleToggle = (num: number) => {
    setMarkedNumbers(prev => {
      const next = new Set(prev);
      if (next.has(num)) { next.delete(num); } else { next.add(num); }
      saveMarked(storageKey, next);
      return next;
    });
  };

  // Shared claim grid — used in both portrait (below ticket) and landscape right panel
  const CLAIM_GRID_TYPES: ClaimType[] = [
    'EARLY_FIVE',  'FULL_HOUSE',   'FOUR_CORNERS',
    'FIRST_ROW',   'MIDDLE_ROW',   'LAST_ROW',
    'BLOCK_LEFT',  'BLOCK_MIDDLE', 'BLOCK_RIGHT',
  ];
  const CLAIM_GRID_EMOJI: Record<string, string> = {
    EARLY_FIVE: '5️⃣', FULL_HOUSE: '🏆', FOUR_CORNERS: '🔲',
    FIRST_ROW: '1️⃣', MIDDLE_ROW: '🎯', LAST_ROW: '🏁',
    BLOCK_LEFT: '◀️', BLOCK_MIDDLE: '⬛', BLOCK_RIGHT: '▶️',
  };

  const renderClaimGrid = (compact: boolean, bare = false) => {
    const seen = new Set<string>();
    const uniqueClaims = claims.filter(c => {
      const k = `${c.playerName}:${c.claimType}`;
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
    const globalWinner: Partial<Record<string, string>> = {};
    uniqueClaims.forEach(c => { if (!globalWinner[c.claimType]) globalWinner[c.claimType] = c.playerName; });
    const myClaimed = new Set(uniqueClaims.filter(c => c.playerName === (name ?? '')).map(c => c.claimType));
    const validMarked = new Set([...markedNumbers].filter(n => calledNumbers.has(n)));
    const myName = name ?? '';

    const grid = (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: compact ? 4 : 8, width: '100%' }}>
        {CLAIM_GRID_TYPES.map(type => {
          const isMine = myClaimed.has(type);
          const winner = globalWinner[type];
          const takenByOther = !!(winner && winner !== myName);
          const canClaim = !isMine && !takenByOther && !!ticket && validateClaim(ticket, validMarked, type);

          let bg = 'rgba(255,255,255,0.06)';
          let dotColor = 'rgba(255,255,255,0.22)';
          if (isMine) { bg = 'rgba(74,222,128,0.22)'; dotColor = '#4ade80'; }
          else if (takenByOther) { bg = 'rgba(139,92,246,0.18)'; dotColor = '#a78bfa'; }
          else if (canClaim) { bg = 'rgba(250,204,21,0.16)'; dotColor = '#facc15'; }

          const dotSize = compact ? 8 : 10;

          return (
            <button
              key={type}
              onClick={() => {
                if (isMine || takenByOther || !ticket) return;
                if (!validateClaim(ticket, validMarked, type)) return;
                broadcastClaim(myName, type);
              }}
              style={{
                border: isMine
                  ? '1.5px solid rgba(74,222,128,0.5)'
                  : takenByOther
                  ? '1px solid rgba(139,92,246,0.28)'
                  : canClaim
                  ? '1.5px solid rgba(250,204,21,0.55)'
                  : '1px solid rgba(255,255,255,0.08)',
                borderRadius: compact ? 8 : 12,
                padding: compact ? '5px 2px' : '8px 4px',
                background: bg,
                cursor: (isMine || takenByOther) ? 'default' : 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: compact ? 2 : 4,
                transition: 'transform 0.12s ease',
              }}
              onTouchStart={e => { if (!isMine && !takenByOther) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.86)'; }}
              onTouchEnd={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
            >
              <span style={{ fontSize: compact ? '0.85rem' : '1.1rem', lineHeight: 1 }}>
                {isMine ? '✅' : takenByOther ? '🔒' : CLAIM_GRID_EMOJI[type]}
              </span>
              <span style={{ width: dotSize, height: dotSize, borderRadius: '50%', background: dotColor, display: 'block', flexShrink: 0 }} />
            </button>
          );
        })}
      </div>
    );

    if (bare) return grid;

    return (
      <div style={{
        borderRadius: compact ? 16 : 20,
        background: 'linear-gradient(135deg,#1a0533,#2d0a52)',
        border: '1px solid rgba(139,92,246,0.2)',
        padding: compact ? '8px 6px' : '12px 10px',
        width: '100%',
        display: 'flex', flexDirection: 'column', gap: compact ? 4 : 6, alignItems: 'center',
      }}>
        {compact && (
          <div style={{ fontSize: '0.42rem', fontWeight: 900, letterSpacing: '0.1em', color: '#7c3aed', textTransform: 'uppercase', marginBottom: 2 }}>
            CLAIMS
          </div>
        )}
        {!compact && (
          <div style={{ fontSize: '0.55rem', fontWeight: 900, letterSpacing: '0.2em', color: '#ec4899', textTransform: 'uppercase', marginBottom: 2 }}>
            Quick Claim
          </div>
        )}
        {grid}
      </div>
    );
  };

  if (!sessionActive) {
    return (
      <div style={{ minHeight: '100vh', background: '#07030f', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
        <span style={{ fontSize: '3rem' }}>🎮</span>
        <p style={{ fontWeight: 900, fontSize: '1.4rem', background: 'linear-gradient(90deg,#f97316,#ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Game Closed
        </p>
        <p style={{ fontSize: '0.85rem', color: '#7c3aed', textAlign: 'center' }}>
          The host has closed session <strong style={{ color: '#fde68a', letterSpacing: '0.1em' }}>{pin}</strong>.<br />Ask the host for a new PIN to join again.
        </p>
        <button
          onClick={() => router.push('/join')}
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

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <style>{`
          /* ── Portrait (default) ── */
          .game-body {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 16px;
            padding: 16px 12px 80px;
            max-width: 480px;
            margin: 0 auto;
            width: 100%;
            box-sizing: border-box;
            overflow-x: hidden;
            overflow-y: auto;
          }
          .ticket-panel { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
          /* portrait-hero uses flex in portrait, hidden in landscape via media query */
          .portrait-hero { display: flex; }
          /* portrait-nudge shows as flex column in portrait */
          .portrait-nudge { display: flex; flex-direction: column; gap: 6px; }
          /* hide landscape-only sidebars in portrait */
          .landscape-left, .landscape-right { display: none; }
          /* hide portrait-only elements in landscape */
          .portrait-only { display: block; }

          /* ── Landscape ── */
          @media (min-aspect-ratio: 1/1) {
            .game-body {
              flex-direction: row;
              max-width: 100%;
              padding: 8px 10px 8px;
              gap: 10px;
              align-items: flex-start;
              overflow-y: hidden;
            }
            /* hide the portrait hero card; show landscape sidebars */
            .portrait-hero { display: none; }
            .portrait-nudge { display: none; }
            .portrait-only { display: none; }
            .landscape-left {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: flex-start;
              width: 110px;
              flex-shrink: 0;
              position: sticky;
              top: 0;
              height: calc(100vh - 60px);
              gap: 8px;
              padding-top: 4px;
            }
            .landscape-right {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: flex-start;
              width: 106px;
              flex-shrink: 0;
              position: sticky;
              top: 0;
              height: calc(100vh - 60px);
              gap: 8px;
              overflow-y: auto;
              padding-top: 4px;
            }
            .ticket-panel {
              flex: 1;
              overflow-y: auto;
              max-height: calc(100vh - 60px);
              gap: 10px;
            }
          }
        `}</style>
        <div className="game-body">

          {/* ── LANDSCAPE LEFT: Last Called number ── */}
          <div className="landscape-left">
            <div style={{
              borderRadius: 20,
              background: 'linear-gradient(135deg,#1a0533,#2d0a52)',
              border: '1px solid rgba(139,92,246,0.2)',
              padding: '16px 12px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: '100%',
            }}>
              <p style={{ fontSize: '0.5rem', fontWeight: 900, letterSpacing: '0.2em', color: '#7c3aed', textTransform: 'uppercase' }}>
                Last Called
              </p>
              <div style={{
                fontSize: displayedLastCalled ? '3.8rem' : '3rem',
                fontWeight: 900, lineHeight: 1, fontVariantNumeric: 'tabular-nums',
                color: displayedLastCalled ? '#facc15' : lastCalled ? '#a855f7' : '#4c1d95',
                filter: displayedLastCalled ? 'drop-shadow(0 0 14px rgba(249,115,22,0.6))' : 'none',
                transition: 'all 0.5s',
                animation: lastCalled && !displayedLastCalled ? 'player-pulse 0.5s ease-in-out infinite alternate' : 'none',
              }}>
                {displayedLastCalled ?? (lastCalled ? '...' : '--')}
              </div>
              <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#6d28d9' }}>
                {displayedCalledCount} <span style={{ color: 'rgba(109,40,217,0.4)' }}>/ 90</span>
              </div>
            </div>
            {/* Nudge / status in landscape */}
            <div style={{
              borderRadius: 12, padding: '8px 8px', width: '100%',
              background: statusMode === 'nudge' && lastNudge && hintsEnabled
                ? 'linear-gradient(135deg, rgba(250,204,21,0.18), rgba(249,115,22,0.12))'
                : statusMode === 'claim' && statusClaim
                ? 'rgba(139,92,246,0.15)'
                : 'rgba(255,255,255,0.03)',
              border: statusMode === 'nudge' && lastNudge && hintsEnabled
                ? '1.5px solid rgba(250,204,21,0.45)'
                : statusMode === 'claim'
                ? '1px solid rgba(139,92,246,0.3)'
                : '1px solid rgba(255,255,255,0.06)',
              transition: 'all 0.3s ease',
              textAlign: 'center', minHeight: 40, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 2,
            }}>
              {statusMode === 'nudge' && lastNudge && hintsEnabled ? (
                <>
                  <div style={{ fontWeight: 900, fontSize: '0.7rem', color: '#facc15' }}>✨ Row {lastNudge.row}</div>
                  <div style={{ fontWeight: 700, fontSize: '0.58rem', color: '#fcd34d' }}>{lastNudge.num} on ticket</div>
                </>
              ) : statusMode === 'claim' && statusClaim ? (
                <>
                  {(() => {
                    const emojiMap: Record<string, string> = { EARLY_FIVE: '5️⃣', FOUR_CORNERS: '🔲', FIRST_ROW: '1️⃣', MIDDLE_ROW: '🎯', LAST_ROW: '🏁', BLOCK_LEFT: '◀️', BLOCK_MIDDLE: '⬛', BLOCK_RIGHT: '▶️', FULL_HOUSE: '🏆' };
                    return <div style={{ fontSize: '1rem' }}>{emojiMap[statusClaim.claimType] ?? '🎉'}</div>;
                  })()}
                  <div style={{ fontWeight: 900, fontSize: '0.6rem', color: statusClaim.playerName === (name ?? '') ? '#4ade80' : '#c084fc' }}>
                    {statusClaim.playerName === (name ?? '') ? 'You!' : statusClaim.playerName.split(' ')[0]}
                  </div>
                </>
              ) : (
                <div style={{ fontWeight: 700, fontSize: '0.55rem', color: 'rgba(255,255,255,0.2)' }}>—</div>
              )}
            </div>
          </div>

          {/* ── CENTER: Ticket + Claims (portrait hero lives here too) ── */}
          <div className="ticket-panel">

            {/* Portrait hero card — Last Called + Quick Claim grid side by side */}
            <div className="portrait-hero" style={{
              borderRadius: 28,
              background: 'linear-gradient(135deg,#1a0533,#2d0a52)',
              border: '1px solid rgba(139,92,246,0.2)',
              padding: '16px 18px',
              alignItems: 'stretch', gap: 14,
            }}>
              {/* Last Called */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <p style={{ fontSize: '0.62rem', fontWeight: 900, letterSpacing: '0.25em', color: '#7c3aed', textTransform: 'uppercase', marginBottom: 6 }}>
                  Last Called
                </p>
                <div style={{
                  fontSize: displayedLastCalled ? '5rem' : '4rem',
                  fontWeight: 900, lineHeight: 1, fontVariantNumeric: 'tabular-nums',
                  color: displayedLastCalled ? '#facc15' : lastCalled ? '#a855f7' : '#4c1d95',
                  filter: displayedLastCalled ? 'drop-shadow(0 0 18px rgba(249,115,22,0.5))' : 'none',
                  transition: 'all 0.5s',
                  animation: lastCalled && !displayedLastCalled ? 'player-pulse 0.5s ease-in-out infinite alternate' : 'none',
                }}>
                  {displayedLastCalled ?? (lastCalled ? '...' : '--')}
                </div>
                {/* Called count inline */}
                <div style={{ marginTop: 6, fontSize: '0.62rem', fontWeight: 700, color: '#6d28d9' }}>
                  {displayedCalledCount} <span style={{ color: 'rgba(109,40,217,0.5)' }}>/ 90</span>
                </div>
              </div>

              {/* Divider */}
              <div style={{ width: 1, background: 'rgba(139,92,246,0.2)', flexShrink: 0 }} />

              {/* Quick Claim 3×3 — same height as Last Called block */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
                <p style={{ fontSize: '0.55rem', fontWeight: 900, letterSpacing: '0.2em', color: '#ec4899', textTransform: 'uppercase', marginBottom: 2 }}>
                  Claim
                </p>
                {renderClaimGrid(true, true)}
              </div>
            </div>

            {/* ── Persistent Status Bar ── */}
            {(() => {
              const CLAIM_EMOJI: Record<string, string> = {
                EARLY_FIVE: '5️⃣', FOUR_CORNERS: '🔲',
                FIRST_ROW: '1️⃣', MIDDLE_ROW: '🎯',
                LAST_ROW: '🏁', BLOCK_LEFT: '◀️',
                BLOCK_MIDDLE: '⬛', BLOCK_RIGHT: '▶️',
                FULL_HOUSE: '🏆',
              };
              const CLAIM_LABEL: Record<string, string> = {
                EARLY_FIVE: 'Early 5', FOUR_CORNERS: '4 Corners',
                FIRST_ROW: 'First Row', MIDDLE_ROW: 'Middle Row',
                LAST_ROW: 'Last Row', BLOCK_LEFT: 'Left Block',
                BLOCK_MIDDLE: 'Mid Block', BLOCK_RIGHT: 'Right Block',
                FULL_HOUSE: 'Full House',
              };
              const myName = name ?? '';

              return (
                <div className="portrait-nudge">
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 16px', borderRadius: 16,
                    background: statusMode === 'nudge'
                      ? 'linear-gradient(135deg, rgba(250,204,21,0.18), rgba(249,115,22,0.12))'
                      : statusMode === 'claim' && statusClaim?.playerName === myName
                      ? 'linear-gradient(135deg, rgba(74,222,128,0.18), rgba(22,163,74,0.12))'
                      : statusMode === 'claim'
                      ? 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(109,40,217,0.12))'
                      : 'rgba(255,255,255,0.04)',
                    border: statusMode === 'nudge'
                      ? '1.5px solid rgba(250,204,21,0.45)'
                      : statusMode === 'claim' && statusClaim?.playerName === myName
                      ? '1.5px solid rgba(74,222,128,0.45)'
                      : statusMode === 'claim'
                      ? '1.5px solid rgba(139,92,246,0.35)'
                      : '1px solid rgba(255,255,255,0.07)',
                    minHeight: 42,
                    transition: 'background 0.3s ease, border-color 0.3s ease',
                  }}>
                    {statusMode === 'idle' && (
                      <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.25)', fontWeight: 700 }}>
                        Waiting for next number…
                      </span>
                    )}
                    {statusMode === 'nudge' && lastNudge && hintsEnabled && (
                      <>
                        <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>✨</span>
                        <div>
                          <span style={{ fontWeight: 900, fontSize: '0.88rem', color: '#facc15' }}>{lastNudge.num} is on your ticket!</span>
                          <span style={{ fontWeight: 700, fontSize: '0.75rem', color: '#fcd34d', marginLeft: 6 }}>→ Row {lastNudge.row}</span>
                        </div>
                      </>
                    )}
                    {statusMode === 'claim' && statusClaim && (
                      <>
                        <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{CLAIM_EMOJI[statusClaim.claimType] ?? '🎉'}</span>
                        <span style={{ fontWeight: 900, fontSize: '0.82rem', color: statusClaim.playerName === myName ? '#4ade80' : '#c084fc' }}>
                          {statusClaim.playerName === myName ? 'You' : statusClaim.playerName}
                        </span>
                        <span style={{ fontWeight: 700, fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)', marginLeft: 2 }}>
                          claimed {CLAIM_LABEL[statusClaim.claimType] ?? statusClaim.claimType}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            })()}

        {/* ── Ticket ── */}
        <div style={{ borderRadius: 28, padding: 2, background: 'linear-gradient(135deg,#8b5cf6,#ec4899,#f97316)' }}>
          <div style={{ borderRadius: 26, background: '#0e0620', padding: '14px 10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: '0.6rem', fontWeight: 900, letterSpacing: '0.25em', color: '#a855f7', textTransform: 'uppercase' }}>
                Your Ticket
              </span>
              <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#6d28d9', letterSpacing: '0.1em' }}>
                tap to mark · tap again to unmark
              </span>
            </div>
            {ticket ? (
              <Ticket ticket={ticket} markedNumbers={markedNumbers} onToggle={handleToggle} flashNumber={hintsEnabled ? displayedLastCalled : null} />
            ) : (
              <div style={{ height: 160, borderRadius: 16, background: 'rgba(88,28,135,0.2)' }} />
            )}
            {/* ── Marked count + recent numbers ── */}
            {ticket && (
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                {/* Marked count */}
                {(() => {
                  const validMarked = [...markedNumbers].filter(n => calledNumbers.has(n)).length;
                  return (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)',
                      borderRadius: 10, padding: '4px 10px', flexShrink: 0,
                    }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#4ade80' }}>✓</span>
                      <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#4ade80' }}>{validMarked}</span>
                      <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgba(74,222,128,0.6)' }}>marked</span>
                    </div>
                  );
                })()}
                {/* Last 5 called */}
                {displayedRecentNumbers.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {displayedRecentNumbers.map((n, i) => {
                      const isOnTicket = ticket.some(row => row.includes(n));
                      return (
                        <span key={n} style={{
                          width: 26, height: 26, borderRadius: '50%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 900, fontSize: '0.65rem',
                          background: i === 0
                            ? 'linear-gradient(135deg,#facc15,#f97316)'
                            : isOnTicket
                            ? 'rgba(139,92,246,0.3)'
                            : 'rgba(255,255,255,0.06)',
                          color: i === 0 ? '#1a0a00' : isOnTicket ? '#c4b5fd' : '#6d28d9',
                          border: i === 0 ? 'none' : isOnTicket ? '1px solid rgba(139,92,246,0.4)' : '1px solid rgba(255,255,255,0.06)',
                          opacity: i === 0 ? 1 : 1 - i * 0.15,
                        }}>
                          {n}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Full Claims dashboard (scrollable, has scoreboard + feed) ── */}
        <ClaimsDashboard
          ticket={ticket ?? []}
          markedNumbers={markedNumbers}
          calledNumbers={calledNumbers}
          playerName={name ?? 'Player'}
          onClaim={broadcastClaim}
          allClaims={claims}
        />

          </div>{/* end ticket-panel */}

          {/* ── LANDSCAPE RIGHT: claim grid only ── */}
          <div className="landscape-right">
            {renderClaimGrid(true)}
          </div>

        </div>{/* end game-body */}
      </main>
      <style>{`
        @keyframes player-pulse {
          from { opacity: 0.4; transform: scale(0.95); }
          to   { opacity: 1;   transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
}
