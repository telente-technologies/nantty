import type { ReactNode } from "react";
import { ScrollView, StyleSheet } from "react-native";

import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";

export interface SettingsPageProps {
  readonly title: string;
  readonly children: ReactNode;
  readonly right?: ReactNode;
  readonly contentTopSpacing?: number;
  readonly gap?: number;
}

export function SettingsPage({ title, children, right, contentTopSpacing = 40, gap = 48 }: SettingsPageProps) {
  return (
    <Screen>
      <Header title={title} right={right} />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: contentTopSpacing, gap }]} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({ content: { paddingHorizontal: 16, paddingBottom: 40 } });
