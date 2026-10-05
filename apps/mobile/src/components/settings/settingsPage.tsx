import type { ReactElement, ReactNode } from "react";
import { ScrollView, StyleSheet, type RefreshControlProps } from "react-native";

import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { spacing } from "@/constants/spacing.constant";

export interface SettingsPageProps {
  readonly title: string;
  readonly children: ReactNode;
  readonly right?: ReactNode;
  readonly contentTopSpacing?: number;
  readonly gap?: number;
  readonly refreshControl?: ReactElement<RefreshControlProps>;
}

export function SettingsPage({ title, children, right, contentTopSpacing = 40, gap = 48, refreshControl }: SettingsPageProps) {
  return (
    <Screen>
      <Header title={title} right={right} />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: contentTopSpacing, gap }]} keyboardShouldPersistTaps="handled" refreshControl={refreshControl}>
        {children}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({ content: { paddingHorizontal: spacing[4], paddingBottom: spacing[8] } });
