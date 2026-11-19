import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Chrome < 110 / Safari < 16 lack these (Android WebViews and old phones in Sentry, 2026-11-18),
    // and Next doesn't polyfill them, so a product page crashed. Copy and sort instead.
    rules: {
      "no-restricted-syntax": ["error", {
        selector: "MemberExpression[property.name=/^(toSorted|toReversed|toSpliced|findLast|findLastIndex)$/]",
        message: "Not in Chrome < 110 / Safari < 16. Use [...arr].sort() (or reverse/splice on a copy).",
      }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".open-next/**",
  ]),
]);

export default eslintConfig;
