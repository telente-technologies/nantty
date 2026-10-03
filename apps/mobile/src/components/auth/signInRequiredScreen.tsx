import { StyleSheet, View } from "react-native";

import { UserCircle24Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { makeThemedStyles } from "@/theme";
import { openAuthFlowThenReturn } from "@/utils/requireAuth.util";

export function SignInRequiredScreen({ phrase }: { phrase: string }) {
  const styles = useStyles();
  return (
    <Screen>
      <Header />
      <View style={styles.body}>
        <View style={styles.badge}>
          <UserCircle24Icon />
        </View>
        <Text size={18} weight={600} align="center" accessibilityRole="header">
          Sign in to {phrase}
        </Text>
        <Text size={14} align="center" style={styles.message}>
          Browsing is open to everyone. Create a free account or sign in to keep going, and you will come right back here.
        </Text>
        <View style={styles.buttons}>
          <Button title="Sign in" onPress={() => openAuthFlowThenReturn("login")} />
          <Button variant="outline" title="Create account" onPress={() => openAuthFlowThenReturn("signup")} />
        </View>
      </View>
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  body: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 12 },
  badge: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  message: { color: colors.textSubtle },
  buttons: { alignSelf: "stretch", gap: 12, marginTop: 20 },
}));
