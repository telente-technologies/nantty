import { failValidation } from "@/mocks/mockResponses.mock";
import type { AppStoreFeeSettings } from "@/types/platformConfiguration.type";

import { readBooleanValue, readIntegerBetween, readObjectAtPath } from "./configurationFieldReaders.mock";

const allowedKeys = new Set(["appleFeeBps", "appleSmallBusinessProgram", "appleSmallBusinessFeeBps", "googleSubscriptionFeeBps"]);
const maximumStoreFeeBps = 5_000;

export function validateAppStoreFees(rawContent: unknown): AppStoreFeeSettings {
  const content = readObjectAtPath(rawContent, "content");
  for (const key of Object.keys(content)) if (!allowedKeys.has(key)) failValidation(`content.${key}`, "This is not an app store fee setting.");
  return {
    appleFeeBps: readIntegerBetween(content, "appleFeeBps", "content", 0, maximumStoreFeeBps),
    appleSmallBusinessProgram: readBooleanValue(content, "appleSmallBusinessProgram", "content"),
    appleSmallBusinessFeeBps: readIntegerBetween(content, "appleSmallBusinessFeeBps", "content", 0, maximumStoreFeeBps),
    googleSubscriptionFeeBps: readIntegerBetween(content, "googleSubscriptionFeeBps", "content", 0, maximumStoreFeeBps),
  };
}
