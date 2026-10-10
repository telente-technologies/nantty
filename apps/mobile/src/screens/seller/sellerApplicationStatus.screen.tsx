import { useQuery } from "@tanstack/react-query";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import { formatFriendlyDateTime } from "@/components/escrow/escrowStage.util";
import { StatusPill } from "@/components/escrow/statusPill";
import { IDENTITY_DOCUMENT_OPTIONS } from "@/components/seller/applicationIdentityStep";
import { sellerQueryKeys } from "@/components/seller/sellerQueries.hook";
import { SellerWebAppNote } from "@/components/seller/sellerWebAppNote";
import { SettingsGroup, SettingsRow } from "@/components/settings/settingsGroup";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { sellerService } from "@/services/sellers/seller.service";
import { ErrorState } from "@/components/ui/errorState";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { spacing } from "@/constants/spacing.constant";
import { typeScale } from "@/constants/typography.constant";

const STATUS_COPY = {
  pending: { title: "Application under review", tone: "caution" as const, label: "Under review", body: "We're checking your details and ID. This usually takes up to 2 working days — we'll notify you as soon as it's done." },
  approved: { title: "You're approved!", tone: "success" as const, label: "Approved", body: "Your store is live. Add your first products and start selling with escrow protection." },
  rejected: { title: "Application not approved", tone: "error" as const, label: "Not approved", body: "Please review the reason below, fix the details and apply again." },
};

export function SellerApplicationStatusScreen({ navigation }: MainScreenProps<"SellerApplicationStatus">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const application = useQuery({ queryKey: sellerQueryKeys.application, queryFn: sellerService.fetchMySellerApplication });
  const details = application.data;
  const muted = { color: colors.textMuted, weight: 400 as const };

  return (
    <Screen>
      <Header title="Seller application" onBack={() => navigation.popToTop()} />
      {!details ? (
        application.isLoading ? <ListSkeleton /> : application.isError ? (
          <ErrorState message="Couldn't load your application." onRetry={() => application.refetch()} retrying={application.isRefetching} />
        ) : (
          <View style={styles.empty}>
            <Text align="center" color={colors.textSubtle}>You haven't applied yet.</Text>
            <Button title="Start selling on Zudomart" onPress={() => navigation.replace("SellerApplication")} />
          </View>
        )
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={application.isRefetching} onRefresh={() => application.refetch()} tintColor={colors.primary} />}
        >
          <View style={styles.hero}>
            <StatusPill label={STATUS_COPY[details.status].label} tone={STATUS_COPY[details.status].tone} />
            <Text size={21} weight={600} lineHeight={25.2} accessibilityRole="header">{STATUS_COPY[details.status].title}</Text>
            <Text size={typeScale.md} lineHeight={19.6} color={colors.textMuted}>{STATUS_COPY[details.status].body}</Text>
            {details.rejectionReason ? <Text size={typeScale.sm} lineHeight={17.5} color={colors.error}>{details.rejectionReason}</Text> : null}
          </View>
          <SettingsGroup>
            <SettingsRow label="Store" trailing={{ text: details.storeName, ...muted }} />
            <SettingsRow label="Category" trailing={{ text: details.categoryName, ...muted }} />
            <SettingsRow label="Location" trailing={{ text: `${details.city}, ${details.state}`, ...muted }} />
            <SettingsRow
              label={IDENTITY_DOCUMENT_OPTIONS.find((option) => option.id === details.identityDocumentType)?.label ?? "ID"}
              trailing={{ text: details.identityDocumentNumberMasked, ...muted }}
            />
            <SettingsRow label={details.payoutBankName} trailing={{ text: details.payoutAccountNumberMasked, ...muted }} />
            <SettingsRow label="Submitted" trailing={{ text: formatFriendlyDateTime(details.submittedAt), ...muted }} />
          </SettingsGroup>
          {details.status === "approved" ? <Button title="Go to seller dashboard" onPress={() => navigation.replace("SellerDashboard")} /> : null}
          {details.status === "rejected" ? <Button title="Apply again" onPress={() => navigation.replace("SellerApplication")} /> : null}
          <SellerWebAppNote />
        </ScrollView>
      )}
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  empty: { padding: spacing[7], gap: spacing[4] },
  content: { paddingHorizontal: spacing[4], paddingTop: spacing[2], paddingBottom: spacing[8], gap: spacing[5] },
  hero: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing[4], gap: spacing[2] },
}));
