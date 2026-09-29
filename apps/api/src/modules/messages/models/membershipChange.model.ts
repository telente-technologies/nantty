export type GroupMembershipChange =
  | { readonly type: "add"; readonly userIds: readonly string[] }
  | { readonly type: "remove"; readonly userId: string }
  | { readonly type: "promote"; readonly userId: string }
  | { readonly type: "demote"; readonly userId: string }
  | { readonly type: "leave" };
