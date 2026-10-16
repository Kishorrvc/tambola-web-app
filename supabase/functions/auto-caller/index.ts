import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

Deno.serve(async () => {
  // Find all active games with auto_calling=true
  const { data: sessions, error } = await supabase
    .from('game_sessions')
    .select('pin, called_numbers, auto_call_ms, last_called_at')
    .eq('auto_calling', true)
    .eq('status', 'active');

  if (error) return new Response(error.message, { status: 500 });
  if (!sessions?.length) return new Response('no active sessions', { status: 200 });

  const results: string[] = [];

  // Process each active session — loop for up to 55s (cron fires every 60s)
  for (const session of sessions) {
    const pin = session.pin;
    const intervalMs: number = session.auto_call_ms ?? 5000;
    const deadline = Date.now() + 55_000;

    while (Date.now() < deadline) {
      // Re-fetch fresh state each iteration
      const { data: fresh } = await supabase
        .from('game_sessions')
        .select('called_numbers, auto_calling, last_called_at')
        .eq('pin', pin)
        .single();

      if (!fresh || !fresh.auto_calling) break; // stopped by host

      const called: number[] = fresh.called_numbers ?? [];
      if (called.length >= 90) {
        await supabase.from('game_sessions').update({ auto_calling: false }).eq('pin', pin);
        break;
      }

      const now = Date.now();
      const elapsed = now - (fresh.last_called_at ?? 0);
      const waitMs = intervalMs - elapsed;

      if (waitMs > 0) {
        await sleep(Math.min(waitMs, deadline - Date.now()));
        continue;
      }

      // Pick a random uncalled number
      const calledSet = new Set(called);
      const remaining: number[] = [];
      for (let i = 1; i <= 90; i++) { if (!calledSet.has(i)) remaining.push(i); }
      const next = remaining[Math.floor(Math.random() * remaining.length)];

      await supabase
        .from('game_sessions')
        .update({ called_numbers: [...called, next], last_called_at: now })
        .eq('pin', pin);

      results.push(`${pin}: called ${next}`);
    }
  }

  return new Response(results.join('\n') || 'done', { status: 200 });
});
