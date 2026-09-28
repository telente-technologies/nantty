import type { AuditRecorder } from "../interfaces/audit.interface.js";
import type { SocialGraph } from "../interfaces/socialGraph.interface.js";
import type { UserDirectory } from "../interfaces/userDirectory.interface.js";
import type { Core } from "./core.loader.js";

export interface CommunicationExternalServices {}

export interface CommunicationSharedServices {
  readonly audit: AuditRecorder;
  readonly userDirectory: UserDirectory;
  readonly socialGraph: SocialGraph;
}

export function createCommunicationModules(core: Core, shared: CommunicationSharedServices, external: CommunicationExternalServices) {
  void core;
  void shared;
  void external;
  return { controllers: {} };
}
