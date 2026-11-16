/** Normalize optional source URL on blur (prefix https when it looks like a bare host). */
export function normalizeSourceUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (looksLikeBareHost(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

function looksLikeBareHost(value: string): boolean {
  return /^[a-z0-9]([a-z0-9-]*\.)+[a-z]{2,}(\/.*)?$/i.test(value);
}

export function validateSourceUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "Enter a full link, like https://example.com/video";
    }
    if (!url.hostname.includes(".")) {
      return "Enter a full link, like https://example.com/video";
    }
    return null;
  } catch {
    return "Enter a full link, like https://example.com/video";
  }
}