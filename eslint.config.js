import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "node_modules",
      "dist",
      "dist-ssr",
      ".output",
      ".vinxi",
      ".tanstack",
      "src-tauri/target",
      "src/routeTree.gen.ts",
      "src/routes/subjects..tsx",
      "src/components/items/**",
      "src/components/layout/**",
      "src/features/dashboard/**",
      "src/features/editors/**",
      "src/stores/**",
      "src/data/imported/**",
      "src/lib/db/tauri-fs-adapter.ts",
      "vault-atelier-main/**",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "no-empty": "off",
    },
  },
  {
    files: ["src/components/ui/**/*.{ts,tsx}", "src/router.tsx"],
    rules: {},
  },
);
