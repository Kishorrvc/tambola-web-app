import React, { useState } from 'react';
import { ClaimType, validateClaim, TambolaTicket, CLAIM_POINTS, TOTAL_POINTS } from '../lib/gameLogic';
import { ClaimEvent } from '../lib/useGameSession';

interface ClaimsDashboardProps {
  ticket: TambolaTicket;
  markedNumbers: Set<number>;
  calledNumbers: Set<number>;
  playerName: string;
  onClaim: (playerName: string, claimType: ClaimType) => void;
  allClaims: ClaimEvent[];
}

const CLAIM_META: Record<ClaimType, { label: string; bg: string; shadow: string; emoji: string }> = {
  EARLY_FIVE:   { label: 'Early 5',      bg: 'linear-gradient(135deg,#06b6d4,#2563eb)', shadow: 'rgba(6,182,212,0.35)',   emoji: '5️⃣' },
  FOUR_CORNERS: { label: '4 Corners',    bg: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', shadow: 'rgba(139,92,246,0.35)', emoji: '🔲' },
  FIRST_ROW:    { label: 'First Row',    bg: 'linear-gradient(135deg,#f97316,#dc2626)', shadow: 'rgba(249,115,22,0.35)',  emoji: '1️⃣' },
  MIDDLE_ROW:   { label: 'Middle Row',   bg: 'linear-gradient(135deg,#ec4899,#be123c)', shadow: 'rgba(236,72,153,0.35)', emoji: '🎯' },
  LAST_ROW:     { label: 'Last Row',     bg: 'linear-gradient(135deg,#fbbf24,#d97706)', shadow: 'rgba(251,191,36,0.35)', emoji: '🏁' },
  BLOCK_LEFT:   { label: 'Left Block',   bg: 'linear-gradient(135deg,#0ea5e9,#0369a1)', shadow: 'rgba(14,165,233,0.35)', emoji: '◀️' },
  BLOCK_MIDDLE: { label: 'Mid Block',    bg: 'linear-gradient(135deg,#a855f7,#7c3aed)', shadow: 'rgba(168,85,247,0.35)', emoji: '⬛' },
  BLOCK_RIGHT:  { label: 'Right Block',  bg: 'linear-gradient(135deg,#f43f5e,#be123c)', shadow: 'rgba(244,63,94,0.35)',  emoji: '▶️' },
  FULL_HOUSE:   { label: 'Full House',   bg: 'linear-gradient(135deg,#34d399,#059669)', shadow: 'rgba(52,211,153,0.35)', emoji: '🏆' },
};

const CLAIM_TYPES = Object.keys(CLAIM_META) as ClaimType[];

function getFailReason(ticket: TambolaTicket, validMarked: Set<number>, type: ClaimType): string {
  const row = (i: number) => ticket[i].filter((n): n is number => n !== null);
  const block = (s: number, e: number) => ticket.flatMap(r => r.slice(s, e).filter((n): n is number => n !== null));
  const allNums = ticket.flat().filter((n): n is number => n !== null);

  switch (type) {
    case 'EARLY_FIVE': {
      const have = allNums.filter(n => validMarked.has(n)).length;
      return `Need 5 matched numbers — you have ${have}`;
    }
    case 'FOUR_CORNERS': {
      const top = row(0); const bot = row(2);
      const corners = [top[0], top[top.length - 1], bot[0], bot[bot.length - 1]];
      const missing = corners.filter(n => !validMarked.has(n));
      return `Missing corners: ${missing.join(', ')}`;
    }
    case 'FIRST_ROW':    return `First row needs: ${row(0).filter(n => !validMarked.has(n)).join(', ')}`;
    case 'MIDDLE_ROW':   return `Middle row needs: ${row(1).filter(n => !validMarked.has(n)).join(', ')}`;
    case 'LAST_ROW':     return `Last row needs: ${row(2).filter(n => !validMarked.has(n)).join(', ')}`;
    case 'BLOCK_LEFT':   return `Left block needs: ${block(0, 3).filter(n => !validMarked.has(n)).join(', ')}`;
    case 'BLOCK_MIDDLE': return `Mid block needs: ${block(3, 6).filter(n => !validMarked.has(n)).join(', ')}`;
    case 'BLOCK_RIGHT':  return `Right block needs: ${block(6, 9).filter(n => !validMarked.has(n)).join(', ')}`;
    case 'FULL_HOUSE': {
      const have = allNums.filter(n => validMarked.has(n)).length;
      return `Need all ${allNums.length} numbers — you have ${have}`;
    }
  }
}

export const ClaimsDashboard: React.FC<ClaimsDashboardProps> = ({
  ticket, markedNumbers, calledNumbers, playerName, onClaim, allClaims,
}) => {
  if (!ticket || ticket.length === 0) return null;

  const [failMsg, setFailMsg] = useState<string | null>(null);

  const myClaimed = new Set(
    allClaims.filter(c => c.playerName === playerName).map(c => c.claimType)
  );

  // One winner per claim type globally — first claim wins
  const globalWinner: Partial<Record<ClaimType, string>> = {};
  allClaims.forEach(c => {
    if (!globalWinner[c.claimType]) globalWinner[c.claimType] = c.playerName;
  });

  const validMarked = new Set([...markedNumbers].filter(n => calledNumbers.has(n)));

  // Scoring: points per player from allClaims
  const scoreMap: Record<string, number> = {};
  allClaims.forEach(c => {
    if (!scoreMap[c.playerName]) scoreMap[c.playerName] = 0;
    // Only count first winner per claim
    if (globalWinner[c.claimType] === c.playerName) {
      scoreMap[c.playerName] += CLAIM_POINTS[c.claimType];
    }
  });
  const scoreboard = Object.entries(scoreMap)
    .sort((a, b) => b[1] - a[1]);
  const claimedPointsTotal = scoreboard.reduce((s, [, p]) => s + p, 0);

  const handleClaim = (type: ClaimType) => {
    if (myClaimed.has(type)) return;
    // Enforce one global winner per type
    if (globalWinner[type]) {
      setFailMsg(`${globalWinner[type]} already claimed ${CLAIM_META[type].label}!`);
      setTimeout(() => setFailMsg(null), 3500);
      return;
    }
    if (!validateClaim(ticket, validMarked, type)) {
      setFailMsg(getFailReason(ticket, validMarked, type));
      setTimeout(() => setFailMsg(null), 3500);
      return;
    }
    setFailMsg(null);
    onClaim(playerName, type);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Claim buttons ── */}
      <div style={{ borderRadius: 28, padding: 2, background: 'linear-gradient(135deg,#ec4899,#8b5cf6,#06b6d4)' }}>
        <div style={{ borderRadius: 26, background: '#0e0620', padding: '16px 14px' }}>
          <p style={{ fontSize: '0.6rem', fontWeight: 900, letterSpacing: '0.25em', color: '#ec4899', textTransform: 'uppercase', textAlign: 'center', marginBottom: 14 }}>
            Claim Your Prize
          </p>

          {failMsg && (
            <div style={{
              marginBottom: 12, padding: '10px 14px', borderRadius: 14,
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: '1rem' }}>❌</span>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fca5a5' }}>{failMsg}</span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {CLAIM_TYPES.map(type => {
              const isMyClaim = myClaimed.has(type);
              const winner = globalWinner[type];
              const takenByOther = winner && winner !== playerName;
              const m = CLAIM_META[type];
              const pts = CLAIM_POINTS[type];
              return (
                <button
                  key={type}
                  onClick={() => handleClaim(type)}
                  disabled={isMyClaim || !!takenByOther}
                  style={{
                    padding: '10px 6px',
                    borderRadius: 16, border: 'none',
                    cursor: (isMyClaim || takenByOther) ? 'default' : 'pointer',
                    fontWeight: 900, fontSize: '0.72rem', color: '#fff',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                    background: isMyClaim
                      ? 'linear-gradient(135deg,#16a34a,#15803d)'
                      : takenByOther
                      ? 'rgba(55,65,81,0.7)'
                      : m.bg,
                    boxShadow: isMyClaim
                      ? '0 0 14px rgba(22,163,74,0.4)'
                      : takenByOther ? 'none'
                      : `0 3px 12px ${m.shadow}`,
                    opacity: takenByOther ? 0.6 : 1,
                  }}
                  onMouseDown={e => { if (!isMyClaim && !takenByOther) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.94)'; }}
                  onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                  onTouchStart={e => { if (!isMyClaim && !takenByOther) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.94)'; }}
                  onTouchEnd={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                >
                  <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>{isMyClaim ? '✅' : takenByOther ? '🔒' : m.emoji}</span>
                  <span style={{ textAlign: 'center', lineHeight: 1.2 }}>{isMyClaim ? 'Claimed!' : m.label}</span>
                  <span style={{ fontSize: '0.6rem', color: isMyClaim ? '#bbf7d0' : takenByOther ? '#9ca3af' : 'rgba(255,255,255,0.7)', fontWeight: 700 }}>
                    {isMyClaim ? `+${pts} pts` : takenByOther ? winner : `${pts} pts`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Scoreboard ── */}
      {scoreboard.length > 0 && (
        <div style={{
          borderRadius: 24,
          background: 'linear-gradient(160deg,#0e0525,#180838)',
          border: '1.5px solid rgba(139,92,246,0.25)',
          padding: '14px 16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <p style={{ fontSize: '0.6rem', fontWeight: 900, letterSpacing: '0.25em', color: '#c084fc', textTransform: 'uppercase' }}>
              🏅 Scoreboard
            </p>
            <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#6d28d9' }}>
              {claimedPointsTotal} / {TOTAL_POINTS} pts claimed
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {scoreboard.map(([player, pts], i) => {
              const pct = Math.round((pts / TOTAL_POINTS) * 100);
              const isMe = player === playerName;
              return (
                <div key={player}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 900, color: isMe ? '#4ade80' : i === 0 ? '#fde68a' : '#d8b4fe' }}>
                      {i === 0 ? '👑 ' : ''}{isMe ? 'You' : player}
                    </span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 900, color: isMe ? '#4ade80' : '#fde68a' }}>
                      {pts} pts · {pct}%
                    </span>
                  </div>
                  <div style={{ width: '100%', height: 5, borderRadius: 999, background: 'rgba(88,28,135,0.3)' }}>
                    <div style={{
                      height: 5, borderRadius: 999, width: `${pct}%`,
                      background: isMe
                        ? 'linear-gradient(90deg,#4ade80,#16a34a)'
                        : i === 0 ? 'linear-gradient(90deg,#facc15,#f97316)'
                        : 'linear-gradient(90deg,#a855f7,#ec4899)',
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Live claims feed ── */}
      {allClaims.length > 0 && (
        <div style={{
          borderRadius: 24,
          background: 'linear-gradient(160deg,#0e0525,#180838)',
          border: '1.5px solid rgba(139,92,246,0.25)',
          padding: '14px 16px',
        }}>
          <p style={{ fontSize: '0.6rem', fontWeight: 900, letterSpacing: '0.25em', color: '#c084fc', textTransform: 'uppercase', marginBottom: 10 }}>
            Claims Feed
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[...allClaims].reverse().map((c, i) => {
              const m = CLAIM_META[c.claimType];
              const isMe = c.playerName === playerName;
              const pts = CLAIM_POINTS[c.claimType];
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', borderRadius: 14,
                  background: isMe
                    ? 'linear-gradient(135deg,rgba(52,211,153,0.15),rgba(16,185,129,0.1))'
                    : 'rgba(139,92,246,0.1)',
                  border: isMe ? '1px solid rgba(52,211,153,0.3)' : '1px solid rgba(139,92,246,0.15)',
                }}>
                  <span style={{ fontSize: '1.1rem' }}>{m.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 900, fontSize: '0.82rem', color: isMe ? '#4ade80' : '#d8b4fe' }}>
                      {isMe ? 'You' : c.playerName}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#a78bfa', marginLeft: 6 }}>
                      claimed {m.label}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.68rem', fontWeight: 900, color: '#fde68a' }}>+{pts}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
