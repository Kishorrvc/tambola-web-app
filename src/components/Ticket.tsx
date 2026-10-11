import React, { useEffect, useState } from 'react';
import { TambolaTicket } from '../lib/gameLogic';

interface TicketProps {
  ticket: TambolaTicket;
  markedNumbers: Set<number>;
  onToggle: (num: number) => void;
  flashNumber?: number | null;
}

const BLOCKS = [[0, 1, 2], [3, 4, 5], [6, 7, 8]];

export const Ticket: React.FC<TicketProps> = ({ ticket, markedNumbers, onToggle, flashNumber }) => {
  const [isClient, setIsClient] = useState(false);
  const [flashing, setFlashing] = useState<number | null>(null);

  useEffect(() => { setIsClient(true); }, []);

  // Flash the matching cell for 2s when a new number is called
  useEffect(() => {
    if (!flashNumber) return;
    setFlashing(flashNumber);
    const t = setTimeout(() => setFlashing(null), 2000);
    return () => clearTimeout(t);
  }, [flashNumber]);

  if (!isClient) {
    return <div style={{ height: 160, borderRadius: 20, background: 'rgba(88,28,135,0.2)' }} />;
  }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, width: '100%' }}>
        {BLOCKS.map((cols, blockIndex) => (
          <div
            key={blockIndex}
            style={{
              display: 'grid',
              gridTemplateRows: 'repeat(3, 1fr)',
              gap: 5,
              padding: 7,
              borderRadius: 18,
              background: 'linear-gradient(145deg, rgba(109,40,217,0.25), rgba(67,20,150,0.18))',
              border: '1.5px solid rgba(139,92,246,0.3)',
            }}
          >
            {ticket.map((row, rowIndex) => (
              <div key={rowIndex} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
                {cols.map(colIndex => {
                  const cell = row[colIndex];
                  const isMarked = cell !== null && markedNumbers.has(cell);
                  const isFlashing = cell !== null && cell === flashing && !isMarked;

                  if (cell === null) {
                    return (
                      <div key={colIndex} style={{ aspectRatio: '1', borderRadius: 10, background: 'rgba(3,7,18,0.6)' }} />
                    );
                  }

                  return (
                    <button
                      key={colIndex}
                      onClick={() => onToggle(cell)}
                      style={{
                        display: 'block',
                        width: '100%',
                        aspectRatio: '1',
                        borderRadius: 10,
                        fontWeight: 900,
                        fontSize: '0.82rem',
                        lineHeight: 1,
                        cursor: 'pointer',
                        border: isFlashing ? '2px solid #facc15' : 'none',
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        transition: isFlashing ? 'none' : 'transform 0.12s, box-shadow 0.12s, background 0.15s',
                        transform: isMarked ? 'scale(0.9)' : isFlashing ? 'scale(1.12)' : 'scale(1)',
                        background: isMarked
                          ? 'linear-gradient(135deg, #4ade80, #16a34a)'
                          : isFlashing
                          ? 'linear-gradient(135deg, #fef08a, #facc15)'
                          : 'linear-gradient(145deg, #1e1b4b, #312e81)',
                        color: isMarked ? '#052e16' : isFlashing ? '#1a0a00' : '#c4b5fd',
                        boxShadow: isMarked
                          ? '0 0 14px rgba(74,222,128,0.6), inset 0 1px 0 rgba(255,255,255,0.15)'
                          : isFlashing
                          ? '0 0 18px rgba(250,204,21,0.9), 0 0 36px rgba(250,204,21,0.4)'
                          : 'inset 0 1px 0 rgba(255,255,255,0.06)',
                        animation: isFlashing ? 'cell-flash 0.4s ease-in-out infinite alternate' : 'none',
                      }}
                    >
                      {cell}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>
      <style>{`
        @keyframes cell-flash {
          from { box-shadow: 0 0 12px rgba(250,204,21,0.7), 0 0 24px rgba(250,204,21,0.3); transform: scale(1.08); }
          to   { box-shadow: 0 0 22px rgba(250,204,21,1),   0 0 44px rgba(250,204,21,0.6); transform: scale(1.15); }
        }
      `}</style>
    </>
  );
};
