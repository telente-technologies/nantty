import { Query } from "@zudojs/cqrs";

export class CheckUsernameAvailabilityQuery extends Query<"auth.check-username-availability"> {
  public constructor(
    public readonly username: string,
  ) {
    super("auth.check-username-availability");
  }
}
