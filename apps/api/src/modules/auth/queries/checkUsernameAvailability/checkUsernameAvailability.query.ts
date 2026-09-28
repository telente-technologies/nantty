import { Query } from "@zudojs/cqrs";

export class CheckUsernameAvailabilityQuery extends Query<"auth.checkUsernameAvailability"> {
  public constructor(
    public readonly username: string,
  ) {
    super("auth.checkUsernameAvailability");
  }
}
