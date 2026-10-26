"use client";

import { ThemeSwitcher } from "@nantty/web-kit";

import { Card } from "@/components/ui/surfaces";

export function AppearanceCard() {
  return (
    <Card title="Appearance" description="Choose light, dark, or match your device. Your choice follows you across Nantty.">
      <ThemeSwitcher label="Theme" />
    </Card>
  );
}
