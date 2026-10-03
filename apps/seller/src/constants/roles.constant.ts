export const staffRoles = ["owner", "manager", "inventory", "sales", "accountant"] as const;

export const staffRoleLabels: Record<(typeof staffRoles)[number], string> = {
  owner: "Owner",
  manager: "Manager",
  inventory: "Inventory staff",
  sales: "Sales staff",
  accountant: "Accountant",
};

export const staffRoleDescriptions: Record<(typeof staffRoles)[number], string> = {
  owner: "Everything, including billing, withdrawals and developer settings.",
  manager: "Runs the store day to day: products, orders, customers, marketing and the team.",
  inventory: "Products, stock levels, adjustments, transfers and suppliers.",
  sales: "Orders, delivery, customers, messages and reviews.",
  accountant: "Money, payouts, reports and analytics. Read-only on orders.",
};
