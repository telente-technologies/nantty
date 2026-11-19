# Nantty Design System Reference

Source of truth: `packages/designTokens/tokens.css`, `packages/designTokens/portalTheme.css`, `packages/designTokens/native.ts`, `packages/webKit/src/`, `apps/web/src/app/globals.css`, and `apps/seller/src/components/layout/`.

## Color Tokens

- **Brand Blue (`--blue-50` .. `--blue-900`)**: Primary `--blue-500: #2043f5`, hover `--blue-600: #1b39cc`, pressed `--blue-700: #152da3`, night surface `--blue-900: #0b1752`, brand tint `--color-brand-tint: #ecefff`.
- **Accent (`--yellow-500`)**: `#f5e320` (on-accent `#0a0a14`).
- **Light Surface Tokens**: `--color-bg: #f7f8fe`, `--color-surface: #ffffff`, `--color-sunken: #f0f2fa`, `--color-text: #0a0a14`, `--color-text-muted: #5b5b6b`, `--color-border: #e4e6f2`, `--color-border-strong: #cdd1e6`.
- **Dark Surface Tokens**: `--color-bg: #15161a`, `--color-elevated: #1e2024`, `--color-text: #e8e9eb`, `--color-brand: #7b90f9`, `--color-brand-solid: #4563f7`, `--color-border: #2c2e33`.
- **Semantic Status Tokens**: `--color-success: #10b981`, `--color-warn: #f59e0b`, `--color-danger: #ef4444` (paired with accessible text variants `--color-success-text`, `--color-warn-text`, `--color-danger-text`).

## Typography, Spacing & Radii

- **Web Font Stack**: `Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif` + `--font-mono`.
- **Mobile Font Stack (`apps/messenger`)**: `@expo-google-fonts/inter` (`400`, `500`, `600`, `700`) mapped to `typeScale` (`12, 13, 14, 16, 20, 24, 32`).
- **Spacing Scale**: `4, 8, 12, 16, 20, 24, 32, 40, 56` (`--space-1` .. `--space-9`).
- **Radii**: `--radius-sm: 6px`, `--radius-md: 10px`, `--radius-lg: 14px`, `--radius-pill: 999px`.
- **Shared `@nantty/web-kit` Components**: `NanttyWordmark`, `ThemeAwareNanttyWordmark`, `ThemeSwitcher`, `ThemeInitScript`, `Skeleton`, `EmptyState`, `Dialog`, `ConfirmDialogHost`, `BrandLoader`, `OfflineBanner`.
