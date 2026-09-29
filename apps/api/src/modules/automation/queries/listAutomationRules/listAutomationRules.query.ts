import { Query } from "@zudojs/cqrs";

export class ListAutomationRulesQuery extends Query<"automation.listAutomationRules"> {
  public constructor() {
    super("automation.listAutomationRules");
  }
}
