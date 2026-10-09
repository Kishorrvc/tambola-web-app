import React, { useState, useEffect } from 'react';

interface HostSetupProps {
  onSetupComplete: (playerCount: number) => void;
}

export const HostSetup: React.FC<HostSetupProps> = ({ onSetupComplete }) => {
  const [playerCount, setPlayerCount] = useState<number>(2);
  const [gameLink, setGameLink] = useState('');

  useEffect(() => {
    setGameLink(`${window.location.origin}/join`);
  }, []);

  return (
    <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-100 max-w-md mx-auto">
      <h2 className="text-2xl font-black text-slate-800 mb-6">Setup Game</h2>
      
      <div className="mb-6">
        <label className="block text-slate-700 font-bold mb-2">Number of Players</label>
        <input 
          type="number" 
          value={playerCount}
          onChange={(e) => setPlayerCount(parseInt(e.target.value))}
          className="w-full p-3 border border-slate-300 rounded-lg"
          min="1"
        />
      </div>

      <button 
        className="w-full bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg mb-6"
        onClick={() => onSetupComplete(playerCount)}
      >
        Generate Tickets & Start
      </button>

      {gameLink && (
        <div className="bg-slate-100 p-4 rounded-lg">
          <p className="text-sm font-bold text-slate-700 mb-2">Share this link with players:</p>
          <code className="text-indigo-600 font-mono break-all">{gameLink}</code>
        </div>
      )}
    </div>
  );
};
