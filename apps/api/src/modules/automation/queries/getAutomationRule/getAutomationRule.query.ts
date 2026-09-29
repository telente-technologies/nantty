import { Query } from "@zudojs/cqrs";

export class GetAutomationRuleQuery extends Query<"automation.getAutomationRule"> {
  public constructor(
    public readonly ruleId: string,
  ) {
    super("automation.getAutomationRule");
  }
}
