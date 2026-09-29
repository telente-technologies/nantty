import type { Metadata } from "next";

import { CustomersListView } from "@/components/customers/customersListView";

export const metadata: Metadata = { title: "Customers" };

export default function CustomersPage() {
  return <CustomersListView />;
}
