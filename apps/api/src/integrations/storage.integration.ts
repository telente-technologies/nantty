import { mkdir } from "node:fs/promises";

import { LocalObjectStorage } from "@zudojs/storage";

import type { Integration } from "./lifecycle.integration.js";

let storage: LocalObjectStorage | undefined;

export function objectStorage(): LocalObjectStorage {
  if (storage === undefined) {
    throw new Error("Object storage is not ready: start the runtime first.");
  }
  return storage;
}

export const storageIntegration: Integration = {
  name: "storage",

  async start({ config }) {
    await mkdir(config.storage.directory, { recursive: true });
    storage = new LocalObjectStorage(config.storage.directory);
  },

  async stop() {
    storage = undefined;
  },

  async health() {
    return storage !== undefined;
  },
};
