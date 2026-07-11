export interface TrackingResult {
  cleaned: string;
  removed: string[];
}

const TRACKING_IMG_PATTERNS = [
  /<img[^>]*src="https?:\/\/[^"]*(tracking|analytics|pixel|beacon|open|track|log)[^"]*"[^>]*>/gi,
  /<img[^>]*src="https?:\/\/[^"]*utm_[^"]*"[^>]*>/gi,
  /<img[^>]*(width|height)="1"[^>]*(width|height)="1"[^>]*>/gi,
  /<img[^>]*style="[^"]*display:\s*none[^"]*"[^>]*>/gi,
];

const TRACKING_SRC_PATTERNS = [
  /src="https?:\/\/[^"]*(tracking|analytics|pixel|beacon)[^"]*\.(gif|png)"/gi,
  /src="https?:\/\/[^"]*utm_[^"]*"/gi,
];

export function detectTrackingPixels(body: string): string[] {
  const found: string[] = [];
  for (const pattern of TRACKING_SRC_PATTERNS) {
    const matches = body.match(pattern);
    if (matches) found.push(...matches);
  }
  return found;
}

export function removeTrackingPixels(body: string): TrackingResult {
  const removed = detectTrackingPixels(body);
  let cleaned = body;
  for (const pattern of TRACKING_IMG_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }
  return { cleaned, removed };
}
