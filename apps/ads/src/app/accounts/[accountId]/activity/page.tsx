import type { Metadata } from "next";

import { ActivityLogPage } from "@/components/activity/activityLogPage";

export const metadata: Metadata = { title: "Activity log" };

export default function Page() {
  return <ActivityLogPage />;
}
