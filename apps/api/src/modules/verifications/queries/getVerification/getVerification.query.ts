import { Query } from "@zudojs/cqrs";

export class GetVerificationQuery extends Query<"verifications.getVerification"> {
  public constructor(
    public readonly profileId: string,
  ) {
    super("verifications.getVerification");
  }
}
