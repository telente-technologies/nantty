import { AsyncLocalStorage } from "node:async_hooks";

import type { ViewerAgeBracket } from "../types/principal.type.js";

const viewerAgeStorage = new AsyncLocalStorage<ViewerAgeBracket>();

export function runWithViewerAgeBracket<T>(ageBracket: ViewerAgeBracket, work: () => T): T {
  return viewerAgeStorage.run(ageBracket, work);
}

export function currentViewerAgeBracket(): ViewerAgeBracket {
  return viewerAgeStorage.getStore() ?? "unknown";
}
