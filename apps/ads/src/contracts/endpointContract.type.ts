import type { ContractSchema } from "./contractSchema.util";

export interface EndpointContract {
  readonly domain: string;
  readonly method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  readonly path: string;
  readonly body?: unknown;
  readonly schema: ContractSchema;
}
