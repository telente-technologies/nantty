import { Query } from "@zudojs/cqrs";

export class GetModerationCaseQuery extends Query<"moderation.getModerationCase"> {
  public constructor(
    public readonly caseId: string,
  ) {
    super("moderation.getModerationCase");
  }
}
