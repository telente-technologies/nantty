import type { Metadata } from "next";

import { LocationsSettingsView } from "@/components/settings/locationsSettingsView";

export const metadata: Metadata = { title: "Locations & registers" };

export default function LocationsSettingsPage() {
  return <LocationsSettingsView />;
}
