import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export function createConfig({ react: withReact = false, next: withNext = false } = {}) {
  return tseslint.config(
    { ignores: ["**/node_modules/**", "**/.next/**", "**/dist/**", "**/build/**", "**/coverage/**", "**/*.d.ts", "**/generated/**", "**/prisma/**"] },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
      languageOptions: { globals: withReact ? { ...globals.browser, ...globals.node } : globals.node },
      rules: {
        "@typescript-eslint/no-explicit-any": "warn",
        "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
        "@typescript-eslint/no-require-imports": "warn",
        "@typescript-eslint/no-empty-object-type": "warn",
        "@typescript-eslint/ban-ts-comment": "warn",
        "no-empty": "warn",
        "no-useless-escape": "warn",
        "no-control-regex": "warn",
        "no-useless-assignment": "warn",
        "preserve-caught-error": "warn",
        "prefer-const": "warn",
      },
    },
    ...(withReact ? [{
      files: ["**/*.{ts,tsx}"],
      plugins: { react, "react-hooks": reactHooks },
      settings: { react: { version: "19.0" } },
      rules: {
        ...react.configs.recommended.rules,
        ...react.configs["jsx-runtime"].rules,
        ...reactHooks.configs.recommended.rules,
        "react/prop-types": "off",
        "react/no-unescaped-entities": "warn",
        "react-hooks/exhaustive-deps": "warn",
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/set-state-in-effect": "warn",
        "react-hooks/purity": "warn",
        "react-hooks/refs": "warn",
        "react-hooks/immutability": "warn",
        "react-hooks/static-components": "warn",
        "react-hooks/preserve-manual-memoization": "warn",
      },
    }] : []),
    ...(withNext ? [{
      files: ["**/*.{ts,tsx}"],
      plugins: { "@next/next": nextPlugin },
      rules: { ...nextPlugin.configs.recommended.rules, ...nextPlugin.configs["core-web-vitals"].rules, "@next/next/no-img-element": "warn" },
    }] : []),
  );
}
