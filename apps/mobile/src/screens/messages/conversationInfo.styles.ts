import { StyleSheet } from "react-native";

import { calculateDefaultLetterSpacing, fontFamily } from "@/constants/typography.constant";
import { spacing } from "@/constants/spacing.constant";
import { makeThemedStyles } from "@/theme";

export const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  encryptionNotice: { paddingHorizontal: spacing[6], paddingVertical: spacing[3] },
  header: { height: 49, paddingHorizontal: spacing[4], flexDirection: "row", alignItems: "center", gap: spacing[5] },
  content: { paddingHorizontal: spacing[4], paddingBottom: spacing[8], gap: spacing[6] },
  identity: { alignItems: "center", gap: spacing[2], paddingTop: spacing[2] },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  section: { gap: 10 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  addMembers: { gap: spacing[3] },
  nameInput: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 8,
    paddingHorizontal: spacing[3],
    fontFamily: fontFamily[500],
    fontSize: 15,
    letterSpacing: calculateDefaultLetterSpacing(15),
    color: colors.text,
  },
}));
