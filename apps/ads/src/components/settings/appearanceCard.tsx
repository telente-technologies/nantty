"use client";

import { ThemeSwitcher } from "@zudomart/web-kit";

import { Card } from "@/components/ui/surfaces";

export function AppearanceCard() {
  return (
    <Card title="Appearance" description="Choose light, dark, or match your device. Your choice follows you across Zudomart.">
      <ThemeSwitcher label="Theme" />
    </Card>
  );
}
