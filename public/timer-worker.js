// Runs in a Web Worker — not subject to browser tab throttling
let intervalId = null;

self.onmessage = (e) => {
  const { type, intervalMs } = e.data;
  if (type === 'start') {
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(() => {
      self.postMessage({ type: 'tick' });
    }, intervalMs);
  }
  if (type === 'stop') {
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
  }
};
