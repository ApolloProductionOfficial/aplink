/**
 * In-memory counters for error filtering diagnostics.
 * Tracks how many errors were filtered as noise vs forwarded as real app errors.
 */

export interface ErrorFilterStats {
  /** Errors silently dropped by shouldIgnore / globalErrorHandler filters */
  filtered: number;
  /** Errors that passed through and were logged / notified */
  forwarded: number;
  /** Breakdown of filtered-by-pattern matches (pattern → count) */
  filteredByPattern: Record<string, number>;
  /** Session start timestamp */
  since: number;
}

const stats: ErrorFilterStats = {
  filtered: 0,
  forwarded: 0,
  filteredByPattern: {},
  since: Date.now(),
};

export function recordFiltered(matchedPattern?: string) {
  stats.filtered++;
  if (matchedPattern) {
    stats.filteredByPattern[matchedPattern] =
      (stats.filteredByPattern[matchedPattern] || 0) + 1;
  }
}

export function recordForwarded() {
  stats.forwarded++;
}

export function getErrorFilterStats(): Readonly<ErrorFilterStats> {
  return stats;
}

export function resetErrorFilterStats() {
  stats.filtered = 0;
  stats.forwarded = 0;
  stats.filteredByPattern = {};
  stats.since = Date.now();
}
