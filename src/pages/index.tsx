import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-6xl font-black text-yellow-400 mb-6 tracking-tighter">TAMBOLA PARTY! 🎲</h1>
      <p className="text-xl text-indigo-200 mb-12">The ultimate communal gathering game.</p>
      
      <div className="flex flex-col gap-4 w-full max-w-xs">
        <Link href="/host" className="bg-emerald-400 text-indigo-950 font-bold py-4 px-8 rounded-2xl text-lg hover:bg-emerald-300 transition-all">
          Host a Game
        </Link>
        <Link href="/join" className="bg-pink-500 text-white font-bold py-4 px-8 rounded-2xl text-lg hover:bg-pink-400 transition-all">
          Join a Game
        </Link>
      </div>
    </div>
  );
}
