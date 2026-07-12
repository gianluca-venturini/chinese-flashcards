import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated component libraries (shadcn/ui + AI SDK Elements) — vendored via
    // the shadcn CLI, not hand-maintained, so exempt from our formatting rules.
    "src/components/ui/**",
    "src/components/ai-elements/**",
  ]),
  {
    rules: {
      // Enable indentation formatting
      indent: ["error", 2, { SwitchCase: 1 }],
      // Ensure consistent spacing
      "eol-last": ["error", "always"],
      "no-trailing-spaces": "error",
    },
  },
]);

export default eslintConfig;
