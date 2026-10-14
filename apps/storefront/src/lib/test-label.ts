// TEST_LABEL is set only where the app runs against the test database (local dev, Vercel Preview):
// order emails and Zalo alerts then start with "[TEST] " so nobody mistakes them for real orders.
// Unset in production → empty, messages unchanged.
export const TEST_PREFIX = process.env.TEST_LABEL ? `[${process.env.TEST_LABEL}] ` : "";
