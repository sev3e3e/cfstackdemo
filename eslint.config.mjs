// @ts-check
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import { globalIgnores } from "eslint/config";
import svelte from "eslint-plugin-svelte";
import "eslint-plugin-only-warn";

import svelteConfig from "./frontend/svelte.config.js";

import globals from "globals";

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.strict,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  globalIgnores([
    "**/dist/**",
    "**/build/**",
    "**/node_modules/**",
    "**/.wrangler/**",
    "**/.svelte-kit/**",
  ]),

  // for frontend(svelte, tailwindcss)
  {
    name: "svelte",
    extends: [
      ...svelte.configs.recommended,
      // ...eslintPluginTailwindCSS.configs["flat/recommended"],
    ],
    files: ["./frontend/**/*.svelte", "./frontend/**/*.svelte.{js,ts}"],

    languageOptions: {
      parserOptions: {
        projectService: true,
        extraFileExtensions: [".svelte"],
        parser: tseslint.parser,
        svelteConfig,
      },
    },
  }
);
