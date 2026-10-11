import { useState, useEffect, useRef } from 'react';

interface HostDashboardProps {
  pin: string;
  calledNumbers: Set<number>;
  lastNumber: number | null;
  onCallNumber: () => void;
}

export const HostDashboard = ({ pin, calledNumbers, lastNumber, onCallNumber }: HostDashboardProps) => {
  const [copied, setCopied] = useState(false);
  const [displayNumber, setDisplayNumber] = useState<number | null>(lastNumber);
  const [rolling, setRolling] = useState(false);
  const prevLastNumber = useRef<number | null>(lastNumber);
  const rollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // When lastNumber changes, run the drum-roll animation
  useEffect(() => {
    if (lastNumber === null || lastNumber === prevLastNumber.current) return;
    prevLastNumber.current = lastNumber;
    setRolling(true);

    const start = Date.now();
    const duration = 2000;
    rollRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      if (elapsed >= duration) {
        clearInterval(rollRef.current!);
        setDisplayNumber(lastNumber);
        setRolling(false);
        return;
      }
      // Slow down as we approach the end
      const progress = elapsed / duration;
      const interval = 60 + progress * 180; // speeds from 60ms → 240ms
      setDisplayNumber(Math.floor(Math.random() * 90) + 1);
    }, 80);

    return () => { if (rollRef.current) clearInterval(rollRef.current); };
  }, [lastNumber]);

  const copyPin = () => {
    navigator.clipboard.writeText(pin).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  const history = Array.from(calledNumbers).reverse();
  const pct = Math.round((calledNumbers.size / 90) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 520, margin: '0 auto' }}>

      {/* ── PIN share bar ── */}
      <div style={{
        borderRadius: 20,
        background: 'linear-gradient(135deg,#1e0a3c,#2d0f5a)',
        border: '1.5px solid rgba(167,139,250,0.3)',
        padding: '14px 18px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <div>
          <p style={{ fontSize: '0.6rem', fontWeight: 900, letterSpacing: '0.3em', color: '#c084fc', textTransform: 'uppercase', marginBottom: 4 }}>
            Share this PIN with players
          </p>
          <p style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '0.25em', color: '#fde68a', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {pin}
          </p>
        </div>
        <button
          onClick={copyPin}
          style={{
            padding: '10px 18px', borderRadius: 14, border: 'none', cursor: 'pointer',
            fontWeight: 900, fontSize: '0.8rem', letterSpacing: '0.05em', transition: 'all 0.15s',
            background: copied ? 'linear-gradient(135deg,#4ade80,#16a34a)' : 'linear-gradient(135deg,#a855f7,#7c3aed)',
            color: '#fff',
            boxShadow: copied ? '0 0 16px rgba(74,222,128,0.45)' : '0 4px 14px rgba(168,85,247,0.4)',
            minWidth: 80,
          }}
        >
          {copied ? '✓ Copied!' : '⎘ Copy'}
        </button>
      </div>

      {/* ── Spotlight ── */}
      <div style={{ borderRadius: 28, padding: 2, background: 'linear-gradient(135deg,#facc15,#f97316,#ec4899,#8b5cf6)' }}>
        <div style={{
          borderRadius: 26, background: 'linear-gradient(160deg,#130526,#1a0535)',
          padding: '28px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
        }}>
          <p style={{ fontSize: '0.65rem', fontWeight: 900, letterSpacing: '0.3em', color: '#f9a8d4', textTransform: 'uppercase' }}>
            Now Calling
          </p>

          <div style={{
            width: 170, height: 170, borderRadius: '50%',
            background: rolling
              ? 'linear-gradient(135deg,#8b5cf6,#ec4899)'
              : displayNumber ? 'linear-gradient(135deg,#facc15,#f97316)' : 'linear-gradient(135deg,#3b0764,#4c1d95)',
            boxShadow: rolling
              ? '0 0 56px rgba(139,92,246,0.7), 0 0 100px rgba(236,72,153,0.4)'
              : displayNumber ? '0 0 56px rgba(251,191,36,0.55), 0 0 100px rgba(249,115,22,0.25)' : '0 0 30px rgba(139,92,246,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: rolling ? 'none' : 'background 0.4s, box-shadow 0.4s',
            animation: rolling ? 'pulse-ring 0.3s ease-in-out infinite alternate' : 'none',
          }}>
            <span style={{
              fontWeight: 900, lineHeight: 1, fontVariantNumeric: 'tabular-nums',
              fontSize: displayNumber !== null ? (displayNumber >= 10 ? '4.5rem' : '5rem') : '3.5rem',
              color: rolling ? '#fff' : displayNumber ? '#030712' : '#a78bfa',
              transition: rolling ? 'none' : 'color 0.3s',
            }}>
              {displayNumber ?? '?'}
            </span>
          </div>

          <div style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#c084fc', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Progress</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#fde68a' }}>{calledNumbers.size} / 90</span>
            </div>
            <div style={{ width: '100%', height: 10, borderRadius: 999, background: 'rgba(88,28,135,0.35)' }}>
              <div style={{
                height: 10, borderRadius: 999, width: `${pct}%`,
                background: 'linear-gradient(90deg,#a855f7,#ec4899,#f97316)',
                boxShadow: pct > 0 ? '0 0 10px rgba(236,72,153,0.6)' : 'none',
                transition: 'width 0.5s ease',
              }} />
            </div>
          </div>

          <button
            onClick={onCallNumber}
            disabled={calledNumbers.size >= 90 || rolling}
            style={{
              width: '100%', padding: '16px 0', borderRadius: 20, border: 'none',
              cursor: (calledNumbers.size >= 90 || rolling) ? 'not-allowed' : 'pointer',
              fontWeight: 900, fontSize: '1.05rem', letterSpacing: '0.05em', color: '#fff',
              background: calledNumbers.size >= 90
                ? 'rgba(55,65,81,0.8)'
                : rolling ? 'linear-gradient(135deg,#8b5cf6,#ec4899)'
                : 'linear-gradient(135deg,#ec4899,#8b5cf6)',
              boxShadow: (calledNumbers.size >= 90 || rolling) ? 'none' : '0 6px 28px rgba(139,92,246,0.5)',
              transition: 'transform 0.12s',
              opacity: rolling ? 0.7 : 1,
            }}
            onMouseDown={e => { if (calledNumbers.size < 90 && !rolling) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.96)'; }}
            onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
            onTouchStart={e => { if (calledNumbers.size < 90 && !rolling) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.96)'; }}
            onTouchEnd={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
          >
            {calledNumbers.size >= 90 ? '🎊 All 90 Called!' : rolling ? '🥁 Rolling...' : '🎲 Call Next Number'}
          </button>
        </div>
      </div>

      {/* ── Recent 5 ── */}
      {history.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '0.6rem', fontWeight: 900, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.2em', flexShrink: 0 }}>
            Recent
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            {history.slice(0, 5).map((num, i) => (
              <div key={num} style={{
                width: 46, height: 46, borderRadius: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 900, fontSize: '1rem',
                background: i === 0 ? 'linear-gradient(135deg,#facc15,#f97316)'
                  : i === 1 ? 'linear-gradient(135deg,#ec4899,#be185d)'
                  : i === 2 ? 'linear-gradient(135deg,#8b5cf6,#6d28d9)'
                  : 'rgba(109,40,217,0.35)',
                color: i < 3 ? '#030712' : '#e9d5ff',
                boxShadow: i === 0 ? '0 0 16px rgba(251,191,36,0.5)' : 'none',
                border: i >= 3 ? '1px solid rgba(139,92,246,0.3)' : 'none',
                transform: `scale(${1 - i * 0.035})`,
                flexShrink: 0,
              }}>
                {num}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Full history ── */}
      {history.length > 0 && (
        <div style={{
          borderRadius: 24, background: 'linear-gradient(160deg,#130526,#1a0435)',
          border: '1.5px solid rgba(139,92,246,0.25)', padding: '18px 20px',
        }}>
          <p style={{ fontSize: '0.6rem', fontWeight: 900, letterSpacing: '0.25em', color: '#c084fc', textTransform: 'uppercase', marginBottom: 10 }}>
            Called — Latest First
          </p>
          <p style={{ fontSize: '1rem', fontWeight: 900, lineHeight: 2, wordBreak: 'break-word' }}>
            {history.map((num, i) => (
              <span key={num}>
                <span style={{ color: i === 0 ? '#facc15' : i % 3 === 1 ? '#f9a8d4' : '#c4b5fd' }}>{num}</span>
                {i < history.length - 1 && (
                  <span style={{ color: '#ec4899', margin: '0 5px', fontSize: '0.65em', opacity: 0.7 }}>✦</span>
                )}
              </span>
            ))}
          </p>
        </div>
      )}
      <style>{`
        @keyframes pulse-ring {
          from { box-shadow: 0 0 40px rgba(139,92,246,0.6), 0 0 80px rgba(236,72,153,0.3); transform: scale(1); }
          to   { box-shadow: 0 0 70px rgba(139,92,246,0.9), 0 0 120px rgba(236,72,153,0.5); transform: scale(1.04); }
        }
      `}</style>
    </div>
  );
};
