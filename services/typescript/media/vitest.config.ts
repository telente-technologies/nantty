import { defineConfig } from "vitest/config";

export default defineConfig({ test: { include: ["tests/**/*.test.ts"], setupFiles: ["tests/setup/limitSharpThreads.setup.ts"], testTimeout: 20_000 } });
