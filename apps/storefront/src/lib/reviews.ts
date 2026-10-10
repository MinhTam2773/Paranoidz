// Mirrors the reviews / review_replies content checks (migration 20261008000003).
export const MAX_REVIEW = 2000;
export const MAX_REPLY = 1000;

// Review photos (migration 20261009000001): the bucket enforces type + size, the trigger the count.
export const MAX_REVIEW_IMAGES = 4;
export const MAX_REVIEW_IMAGE_BYTES = 5 * 1024 * 1024;
export const REVIEW_IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
