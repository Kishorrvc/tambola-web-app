import { useEffect, useState, useRef } from 'react';
import { supabase } from './supabase';
import { ClaimType } from './gameLogic';

export interface ClaimEvent {
  playerName: string;
  claimType: ClaimType;
  ts: number;
}

export function useGameSession(gamePin: string) {
  const [calledNumbers, setCalledNumbers] = useState<Set<number>>(new Set());
  const [lastCalled, setLastCalled] = useState<number | null>(null);
  const [claims, setClaims] = useState<ClaimEvent[]>([]);
  const [hintsEnabled, setHintsEnabled] = useState(true);
  const calledOrderRef = useRef<number[]>([]);

  useEffect(() => {
    if (!gamePin) return;

    let cancelled = false;

    calledOrderRef.current = [];
    setCalledNumbers(new Set());
    setLastCalled(null);
    setClaims([]);
    setHintsEnabled(true);

    // Load called numbers and hints flag from Supabase
    supabase
      .from('game_sessions')
      .select('called_numbers, hints_enabled')
      .eq('pin', gamePin)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const arr: number[] = data?.called_numbers ?? [];
        if (arr.length) {
          calledOrderRef.current = arr;
          setCalledNumbers(new Set(arr));
          setLastCalled(arr[arr.length - 1]);
        }
        setHintsEnabled(data?.hints_enabled ?? true);
      });

    // Load existing claims
    supabase
      .from('game_claims')
      .select('player_name, claim_type, ts')
      .eq('pin', gamePin)
      .order('ts', { ascending: true })
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.length) {
          setClaims(data.map(r => ({
            playerName: r.player_name,
            claimType: r.claim_type as ClaimType,
            ts: r.ts,
          })));
        }
      });

    // Realtime: session updates (called numbers + hints flag)
    const sessionSub = supabase
      .channel(`session-${gamePin}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_sessions', filter: `pin=eq.${gamePin}` },
        (payload) => {
          if (cancelled) return;
          const arr: number[] = (payload.new as any).called_numbers ?? [];
          calledOrderRef.current = arr;
          setCalledNumbers(new Set(arr));
          setLastCalled(arr[arr.length - 1] ?? null);
          setHintsEnabled((payload.new as any).hints_enabled ?? true);
        }
      )
      .subscribe();

    // Realtime: new claims
    const claimSub = supabase
      .channel(`claims-${gamePin}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'game_claims', filter: `pin=eq.${gamePin}` },
        (payload) => {
          if (cancelled) return;
          const r = payload.new as any;
          setClaims(prev => [...prev, {
            playerName: r.player_name,
            claimType: r.claim_type as ClaimType,
            ts: r.ts,
          }]);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      calledOrderRef.current = [];
      supabase.removeChannel(sessionSub);
      supabase.removeChannel(claimSub);
    };
  }, [gamePin]);

  const callNumber = async (num: number) => {
    const nextOrder = [...calledOrderRef.current, num];
    calledOrderRef.current = nextOrder;
    setCalledNumbers(new Set(nextOrder));
    setLastCalled(num);
    const { error } = await supabase
      .from('game_sessions')
      .upsert({ pin: gamePin, called_numbers: nextOrder, status: 'active' });
    if (error) console.error('callNumber upsert error:', error.message);
  };

  const broadcastClaim = async (playerName: string, claimType: ClaimType) => {
    const ts = Date.now();
    setClaims(prev => [...prev, { playerName, claimType, ts }]);
    await supabase
      .from('game_claims')
      .insert({ pin: gamePin, player_name: playerName, claim_type: claimType, ts });
  };

  const toggleHints = async () => {
    const next = !hintsEnabled;
    setHintsEnabled(next);
    await supabase
      .from('game_sessions')
      .update({ hints_enabled: next })
      .eq('pin', gamePin);
  };

  return { calledNumbers, lastCalled, callNumber, claims, broadcastClaim, hintsEnabled, toggleHints };
}
