export const staffRoles = ["owner", "admin", "manager", "cashier", "inventory", "support"] as const;

export const staffRoleLabels: Record<(typeof staffRoles)[number], string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  cashier: "Cashier",
  inventory: "Inventory",
  support: "Support",
};
