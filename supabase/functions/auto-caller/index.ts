import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async () => {
  // Find all active games with auto_calling=true
  const { data: sessions, error } = await supabase
    .from('game_sessions')
    .select('pin, called_numbers, auto_call_ms, last_called_at')
    .eq('auto_calling', true)
    .eq('status', 'active');

  if (error) return new Response(error.message, { status: 500 });
  if (!sessions?.length) return new Response('no active sessions', { status: 200 });

  const now = Date.now();
  const results: string[] = [];

  for (const session of sessions) {
    const called: number[] = session.called_numbers ?? [];
    if (called.length >= 90) {
      // All numbers called — turn off auto_calling
      await supabase.from('game_sessions')
        .update({ auto_calling: false })
        .eq('pin', session.pin);
      results.push(`${session.pin}: done`);
      continue;
    }

    const intervalMs: number = (session.auto_call_ms ?? 5000);
    const lastCalledAt: number = session.last_called_at ?? 0;
    const elapsed = now - lastCalledAt;

    // Not yet time for next call
    if (elapsed < intervalMs) {
      results.push(`${session.pin}: wait ${intervalMs - elapsed}ms`);
      continue;
    }

    // Pick a random uncalled number
    const calledSet = new Set(called);
    const remaining: number[] = [];
    for (let i = 1; i <= 90; i++) {
      if (!calledSet.has(i)) remaining.push(i);
    }
    const next = remaining[Math.floor(Math.random() * remaining.length)];
    const nextCalled = [...called, next];

    const { error: updateErr } = await supabase
      .from('game_sessions')
      .update({ called_numbers: nextCalled, last_called_at: now })
      .eq('pin', session.pin);

    if (updateErr) {
      results.push(`${session.pin}: error ${updateErr.message}`);
    } else {
      results.push(`${session.pin}: called ${next}`);
    }
  }

  return new Response(results.join('\n'), { status: 200 });
});
