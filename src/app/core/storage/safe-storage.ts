// Web Storage can throw (private mode, blocked site data, sandboxed iframes).
// Every read and write in the analytics and mock layers goes through these
// helpers so a storage failure degrades to "not remembered" instead of an error.

type Area = 'local' | 'session';

function area(kind: Area): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readStorage(key: string, kind: Area = 'local'): string | null {
  try {
    return area(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string, kind: Area = 'local'): void {
  try {
    area(kind)?.setItem(key, value);
  } catch {
    // Storage unavailable or full: keep running without persistence.
  }
}

export function readJson<T>(key: string, fallback: T, kind: Area = 'local'): T {
  const raw = readStorage(key, kind);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown, kind: Area = 'local'): void {
  writeStorage(key, JSON.stringify(value), kind);
}
