import React, { useState } from 'react';
import { ClaimType, validateClaim, TambolaTicket } from '../lib/gameLogic';
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
  EARLY_FIVE:   { label: 'Early 5',    bg: 'linear-gradient(135deg,#06b6d4,#2563eb)', shadow: 'rgba(6,182,212,0.35)',  emoji: '5️⃣' },
  FOUR_CORNERS: { label: '4 Corners',  bg: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', shadow: 'rgba(139,92,246,0.35)', emoji: '🔲' },
  FIRST_ROW:    { label: 'First Row',  bg: 'linear-gradient(135deg,#f97316,#dc2626)', shadow: 'rgba(249,115,22,0.35)',  emoji: '1️⃣' },
  MIDDLE_ROW:   { label: 'Middle Row', bg: 'linear-gradient(135deg,#ec4899,#be123c)', shadow: 'rgba(236,72,153,0.35)',  emoji: '🎯' },
  LAST_ROW:     { label: 'Last Row',   bg: 'linear-gradient(135deg,#fbbf24,#d97706)', shadow: 'rgba(251,191,36,0.35)',  emoji: '🏁' },
  FULL_HOUSE:   { label: 'Full House', bg: 'linear-gradient(135deg,#34d399,#059669)', shadow: 'rgba(52,211,153,0.35)',  emoji: '🏆' },
};

const CLAIM_TYPES = Object.keys(CLAIM_META) as ClaimType[];

function getFailReason(ticket: TambolaTicket, validMarked: Set<number>, type: ClaimType): string {
  const row = (i: number) => ticket[i].filter((n): n is number => n !== null);
  const allNums = ticket.flat().filter((n): n is number => n !== null);

  switch (type) {
    case 'EARLY_FIVE': {
      const have = allNums.filter(n => validMarked.has(n)).length;
      return `Need 5 marked & called numbers — you have ${have}`;
    }
    case 'FOUR_CORNERS': {
      const top = row(0); const bot = row(2);
      const corners = [top[0], top[top.length - 1], bot[0], bot[bot.length - 1]];
      const missing = corners.filter(n => !validMarked.has(n));
      return `Missing corners: ${missing.join(', ')}`;
    }
    case 'FIRST_ROW': {
      const missing = row(0).filter(n => !validMarked.has(n));
      return `First row still needs: ${missing.join(', ')}`;
    }
    case 'MIDDLE_ROW': {
      const missing = row(1).filter(n => !validMarked.has(n));
      return `Middle row still needs: ${missing.join(', ')}`;
    }
    case 'LAST_ROW': {
      const missing = row(2).filter(n => !validMarked.has(n));
      return `Last row still needs: ${missing.join(', ')}`;
    }
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

  // Derive from allClaims so it survives refresh (allClaims is loaded from localStorage)
  const myClaimed = new Set(
    allClaims.filter(c => c.playerName === playerName).map(c => c.claimType)
  );

  // Only numbers that are both marked by the player AND revealed by the host count
  const validMarked = new Set([...markedNumbers].filter(n => calledNumbers.has(n)));

  const handleClaim = (type: ClaimType) => {
    if (myClaimed.has(type)) return;
    if (!validateClaim(ticket, validMarked, type)) {
      setFailMsg(getFailReason(ticket, validMarked, type));
      setTimeout(() => setFailMsg(null), 3500);
      return;
    }
    setFailMsg(null);
    onClaim(playerName, type);
  };

  // Latest unique winner per claim type (excluding self)
  const latestWinnerFor = (type: ClaimType) =>
    [...allClaims].reverse().find(c => c.claimType === type && c.playerName !== playerName)?.playerName;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Claim buttons ── */}
      <div style={{ borderRadius: 28, padding: 2, background: 'linear-gradient(135deg,#ec4899,#8b5cf6,#06b6d4)' }}>
        <div style={{ borderRadius: 26, background: '#0e0620', padding: '16px 14px' }}>
          <p style={{ fontSize: '0.6rem', fontWeight: 900, letterSpacing: '0.25em', color: '#ec4899', textTransform: 'uppercase', textAlign: 'center', marginBottom: 14 }}>
            Claim Your Prize
          </p>

          {/* Inline fail reason */}
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {CLAIM_TYPES.map(type => {
              const isClaimed = myClaimed.has(type);
              const m = CLAIM_META[type];
              const otherWinner = latestWinnerFor(type);
              return (
                <button
                  key={type}
                  onClick={() => handleClaim(type)}
                  disabled={isClaimed}
                  style={{
                    padding: '14px 8px',
                    borderRadius: 18, border: 'none',
                    cursor: isClaimed ? 'default' : 'pointer',
                    fontWeight: 900, fontSize: '0.82rem', color: '#fff',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    background: isClaimed ? 'linear-gradient(135deg,#16a34a,#15803d)' : m.bg,
                    boxShadow: isClaimed ? '0 0 16px rgba(22,163,74,0.4)' : `0 4px 16px ${m.shadow}`,
                    opacity: isClaimed ? 0.9 : 1,
                    position: 'relative',
                  }}
                  onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.95)'; }}
                  onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                  onTouchStart={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.95)'; }}
                  onTouchEnd={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                >
                  <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>{isClaimed ? '✅' : m.emoji}</span>
                  <span>{isClaimed ? 'Claimed!' : m.label}</span>
                  {otherWinner && !isClaimed && (
                    <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>
                      {otherWinner} won
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

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
                  <span style={{ fontSize: '0.65rem', color: '#6d28d9' }}>
                    {isMe ? '✓ you' : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
