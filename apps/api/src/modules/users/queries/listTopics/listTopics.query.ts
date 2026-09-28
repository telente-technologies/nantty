import { Query } from "@zudojs/cqrs";

export class ListTopicsQuery extends Query<"users.listTopics"> {
  public constructor() {
    super("users.listTopics");
  }
}
