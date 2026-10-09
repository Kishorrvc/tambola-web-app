import { useState } from 'react';
import { useRouter } from 'next/router';

export default function JoinPage() {
  const [pin, setPin] = useState('');
  const [name, setName] = useState('');
  const router = useRouter();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin && name) {
      router.push(`/game/${pin}?name=${encodeURIComponent(name)}`);
    }
  };

  return (
    <div className="min-h-screen bg-indigo-950 flex items-center justify-center p-6">
      <form onSubmit={handleJoin} className="bg-indigo-900 p-8 rounded-2xl shadow-xl w-full max-w-sm">
        <h2 className="text-3xl font-black text-yellow-400 mb-6">Join Party!</h2>
        <input 
          type="text" 
          placeholder="Enter Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full p-4 rounded-xl mb-4 text-slate-900"
          required
        />
        <input 
          type="text" 
          placeholder="Game PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="w-full p-4 rounded-xl mb-6 text-slate-900"
          required
        />
        <button type="submit" className="w-full bg-pink-500 text-white font-bold py-4 rounded-xl hover:bg-pink-400 transition-all">
          Enter Game
        </button>
      </form>
    </div>
  );
}
