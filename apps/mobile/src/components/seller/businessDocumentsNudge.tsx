import { useNavigation } from "@react-navigation/native";
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";

import { useBusinessDocumentsQuery } from "./businessDocumentsQueries.hook";

export function BusinessDocumentsNudge() {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation();
  const documents = useBusinessDocumentsQuery();
  if (!documents.data || documents.data.allApproved) return null;
  const approvedCount = documents.data.documents.filter((document) => document.status === "approved").length;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Finish your business documents" onPress={() => navigation.navigate("BusinessDocuments")} style={styles.banner}>
      <View style={styles.text}>
        <Text size={14} weight={600} lineHeight={16.8}>Verify your business</Text>
        <Text size={12} lineHeight={16.8} color={colors.textMuted}>
          {approvedCount} of {documents.data.documents.length} documents approved. Your store works as normal. Documents unlock the Gold checkmark.
        </Text>
      </View>
      <Text size={13} weight={500} lineHeight={16.9} color={colors.primary}>Upload</Text>
    </Pressable>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  banner: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.primaryTint, borderRadius: 12, padding: 14, marginHorizontal: 16, marginBottom: 8 },
  text: { flex: 1, gap: 2 },
}));
