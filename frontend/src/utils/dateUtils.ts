/**
 * Utility functions for local timezone conversion, datetime-local inputs, and time formatting.
 */

export function toLocalDatetimeInputValue(date: Date | string | number | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function fromLocalDatetimeInputValue(localStr: string): string {
  if (!localStr) return '';
  const d = new Date(localStr);
  if (isNaN(d.getTime())) return '';
  return d.toISOString();
}

export function isDateInPast(date: Date | string | number | null | undefined): boolean {
  if (!date) return false;
  const d = new Date(date);
  if (isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
}

export function formatDateLocal(date: Date | string | number | null | undefined): string {
  if (!date) return 'N/A';
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'Invalid Date';
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function getTimeRemainingStr(date: Date | string | number | null | undefined): { isPast: boolean; label: string } {
  if (!date) return { isPast: false, label: '' };
  const d = new Date(date);
  if (isNaN(d.getTime())) return { isPast: false, label: '' };
  const diffMs = d.getTime() - Date.now();
  const isPast = diffMs < 0;
  const absDiff = Math.abs(diffMs);
  const mins = Math.floor(absDiff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  let timeSpan = '';
  if (days > 0) timeSpan = `${days}d ${hours % 24}h`;
  else if (hours > 0) timeSpan = `${hours}h ${mins % 60}m`;
  else timeSpan = `${mins}m`;

  return {
    isPast,
    label: isPast ? `${timeSpan} ago` : `in ${timeSpan}`
  };
}
