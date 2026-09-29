import { Query } from "@zudojs/cqrs";

import type { PageRequest } from "../../../../types/pagination.type.js";

export class ListAutomationExecutionsQuery extends Query<"automation.listAutomationExecutions"> {
  public constructor(
    public readonly ruleId: string,
    public readonly page: PageRequest,
  ) {
    super("automation.listAutomationExecutions");
  }
}
