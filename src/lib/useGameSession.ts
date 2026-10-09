import { useEffect, useState, useRef } from 'react';
import { supabase } from './supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { ClaimType } from './gameLogic';

export interface ClaimEvent {
  playerName: string;
  claimType: ClaimType;
  ts: number;
}

function readHostCalledFromStorage(pin: string): number[] {
  try {
    const raw = localStorage.getItem(`host:called:${pin}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function readClaimsFromStorage(pin: string): ClaimEvent[] {
  try {
    const raw = localStorage.getItem(`host:claims:${pin}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveClaimsToStorage(pin: string, claims: ClaimEvent[]) {
  try { localStorage.setItem(`host:claims:${pin}`, JSON.stringify(claims)); } catch {}
}

export function useGameSession(gamePin: string) {
  const [calledNumbers, setCalledNumbers] = useState<Set<number>>(new Set());
  const [lastCalled, setLastCalled] = useState<number | null>(null);
  const [claims, setClaims] = useState<ClaimEvent[]>([]);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!gamePin) return;

    // reset on pin change
    // restore claims from previous session
    setClaims(readClaimsFromStorage(gamePin));

    const ch = supabase.channel(`game:${gamePin}`);

    ch.on('broadcast', { event: 'number_called' }, (payload) => {
      const num = payload.payload.number as number;
      setCalledNumbers(prev => new Set(prev).add(num));
      setLastCalled(num);
    });

    ch.on('broadcast', { event: 'claim_made' }, (payload) => {
      const { playerName, claimType, ts } = payload.payload as ClaimEvent;
      setClaims(prev => {
        const next = [...prev, { playerName, claimType, ts }];
        saveClaimsToStorage(gamePin, next);
        return next;
      });
    });

    ch.subscribe();
    setChannel(ch);

    const syncFromStorage = () => {
      const arr = readHostCalledFromStorage(gamePin);
      if (arr.length === 0) return;
      // always update — avoids any stale-closure or ref-reset issues
      setCalledNumbers(new Set(arr));
      setLastCalled(arr[arr.length - 1]);
    };

    // run immediately so player sees numbers without waiting 1s
    syncFromStorage();
    pollRef.current = setInterval(syncFromStorage, 800);

    return () => {
      ch.unsubscribe();
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [gamePin]);

  const callNumber = (num: number) => {
    if (!channel) return;
    channel.send({ type: 'broadcast', event: 'number_called', payload: { number: num } });
    setCalledNumbers(prev => new Set(prev).add(num));
    setLastCalled(num);
  };

  const broadcastClaim = (playerName: string, claimType: ClaimType) => {
    const event: ClaimEvent = { playerName, claimType, ts: Date.now() };
    if (channel) {
      channel.send({ type: 'broadcast', event: 'claim_made', payload: event });
    }
    setClaims(prev => {
      const next = [...prev, event];
      saveClaimsToStorage(gamePin, next);
      return next;
    });
  };

  return { calledNumbers, lastCalled, callNumber, claims, broadcastClaim };
}
