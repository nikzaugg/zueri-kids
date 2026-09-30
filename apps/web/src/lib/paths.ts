// Joins Astro's BASE_URL ("/" or "/zueri-kids") with a path relative to it.
export function joinBase(base: string, path: string): string {
  return `${base.replace(/\/$/, "")}/${path}`;
}
