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
  const [hostDelayMs, setHostDelayMs] = useState(2000);
  const [playerDelayMs, setPlayerDelayMs] = useState(3000);
  const [autoCallMs, setAutoCallMs] = useState(5000);
  const calledOrderRef = useRef<number[]>([]);

  useEffect(() => {
    if (!gamePin) return;

    let cancelled = false;

    calledOrderRef.current = [];
    setCalledNumbers(new Set());
    setLastCalled(null);
    setClaims([]);
    setHintsEnabled(true);
    setHostDelayMs(2000);
    setPlayerDelayMs(3000);
    setAutoCallMs(5000);

    supabase
      .from('game_sessions')
      .select('called_numbers, hints_enabled, host_delay_ms, player_delay_ms, auto_call_ms')
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
        setHostDelayMs(data?.host_delay_ms ?? 2000);
        setPlayerDelayMs(data?.player_delay_ms ?? 3000);
        setAutoCallMs(data?.auto_call_ms ?? 5000);
      });

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
          setHostDelayMs((payload.new as any).host_delay_ms ?? 2000);
          setPlayerDelayMs((payload.new as any).player_delay_ms ?? 3000);
          setAutoCallMs((payload.new as any).auto_call_ms ?? 5000);
        }
      )
      .subscribe();

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
      .update({ called_numbers: nextOrder })
      .eq('pin', gamePin);
    if (error) console.error('callNumber update error:', error.message);
  };

  const broadcastClaim = async (playerName: string, claimType: ClaimType) => {
    const ts = Date.now();
    await supabase
      .from('game_claims')
      .insert({ pin: gamePin, player_name: playerName, claim_type: claimType, ts });
  };

  const toggleHints = async () => {
    const next = !hintsEnabled;
    setHintsEnabled(next);
    await supabase.from('game_sessions').update({ hints_enabled: next }).eq('pin', gamePin);
  };

  const updateDelays = async (hostMs: number, playerMs: number) => {
    setHostDelayMs(hostMs);
    setPlayerDelayMs(playerMs);
    await supabase.from('game_sessions').update({ host_delay_ms: hostMs, player_delay_ms: playerMs }).eq('pin', gamePin);
  };

  const updateAutoCallMs = async (ms: number) => {
    setAutoCallMs(ms);
    await supabase.from('game_sessions').update({ auto_call_ms: ms }).eq('pin', gamePin);
  };

  return { calledNumbers, lastCalled, callNumber, claims, broadcastClaim, hintsEnabled, toggleHints, hostDelayMs, playerDelayMs, updateDelays, autoCallMs, updateAutoCallMs };
}
