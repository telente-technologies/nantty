export const Role = { BUYER: "buyer", SELLER: "seller", ADMIN: "admin" } as const;
export type Role = (typeof Role)[keyof typeof Role];

export const StoreRole = { OWNER: "owner", MANAGER: "manager", STAFF: "staff" } as const;
export type StoreRole = (typeof StoreRole)[keyof typeof StoreRole];
