export default {
  ignoreFiles: ["**/node_modules/**", "**/.next/**", "packages/designTokens/**", "apps/mobile/**"],
  rules: {
    "color-no-hex": [true, { severity: "warning", message: "Use a semantic token from @nantty/design-tokens instead of a raw hex colour." }],
    "declaration-property-value-disallowed-list": [
      { "font-size": ["/^\\d+(\\.\\d+)?px$/"] },
      { severity: "warning", message: "Use a --fs-* token instead of a raw px font-size." },
    ],
  },
};
