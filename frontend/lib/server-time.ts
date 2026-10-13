/**
 * Tracks the offset between the server clock and the browser clock, so countdowns are correct even
 * when the user's device clock is wrong. Updated from every response/event carrying `serverTime`.
 */
let offsetMs = 0;

export function syncServerTime(serverTimeIso: string | undefined) {
  if (!serverTimeIso) return;
  const serverMs = new Date(serverTimeIso).getTime();
  if (!Number.isNaN(serverMs)) offsetMs = serverMs - Date.now();
}

export function serverNow(): number {
  return Date.now() + offsetMs;
}
