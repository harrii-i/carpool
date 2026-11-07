/** Small display formatters shared across ride screens. */

export function formatDeparture(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return `Today · ${time}`;
  if (isTomorrow) return `Tomorrow · ${time}`;
  const day = date.toLocaleDateString([], { day: 'numeric', month: 'short' });
  return `${day} · ${time}`;
}

/** Chat-list timestamp convention: time-only for today, short date otherwise. */
export function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

export function formatDistance(m: number | null): string | null {
  if (m == null) return null;
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function formatContribution(amount: string | null): string {
  if (!amount || Number(amount) === 0) return 'Free';
  return `₹${Number(amount).toFixed(0)}`;
}

export function formatRating(value: string | number): string {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(1) : '—';
}
