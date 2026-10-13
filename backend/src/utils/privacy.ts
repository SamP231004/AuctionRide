/**
 * Masks a display name for public bid histories: "Rahul Sharma" → "R***l S.".
 * Bidders can still recognise themselves (their own bids are returned unmasked).
 */
export function maskName(name: string): string {
  const [first = '', ...rest] = name.trim().split(/\s+/);
  const maskedFirst =
    first.length <= 2 ? `${first[0] ?? '?'}*` : `${first[0]}${'*'.repeat(3)}${first[first.length - 1]}`;
  const lastInitial = rest.length > 0 ? ` ${rest[rest.length - 1]?.[0]?.toUpperCase()}.` : '';
  return `${maskedFirst}${lastInitial}`;
}
