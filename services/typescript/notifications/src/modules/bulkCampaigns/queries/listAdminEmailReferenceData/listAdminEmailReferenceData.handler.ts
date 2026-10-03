import type { IdentityDirectory } from "../../../../interfaces/identityDirectory.interface.js";
import { adminEmailTemplates } from "../../../../constants/adminEmailTemplates.constant.js";

export class ListAdminEmailReferenceDataHandler {
  public constructor(private readonly identity: IdentityDirectory) {}

  public listTemplates() {
    return { data: adminEmailTemplates, nextCursor: null };
  }

  public async listSegments() {
    return { data: await this.identity.listSegments(), nextCursor: null };
  }
}
