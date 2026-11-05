import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { AuthStep } from "@/components/auth/authStep";
import { Warning20Icon } from "@/components/icons";
import { TextField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { AuthScreenProps } from "@/navigation/navigation.types";
import { ApiError } from "@/errors/api.error";
import { authService } from "@/services/auth/auth.service";
import { useAuthStore } from "@/store/auth.store";

export function LoginScreen({ navigation }: AuthScreenProps<"Login">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const saveSignedInSession = useAuthStore((s) => s.saveSignedInSession);

  const submitLoginForm = async () => {
    setError(null);
    setLoading(true);
    try {
      await saveSignedInSession(await authService.logInWithEmailOrUsername(identifier.trim(), password));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't log in. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthStep actionTitle="Log in" actionDisabled={!identifier.trim() || !password} loading={loading} onAction={submitLoginForm}>
      <View style={styles.fields}>
        <TextField
          label="Email or username"
          placeholder="Enter your email or username"
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
          autoComplete="username"
          autoFocus
          textContentType="username"
          keyboardType="default"
          returnKeyType="next"
        />
        <TextField
          label="Password"
          placeholder="Enter password"
          value={password}
          onChangeText={setPassword}
          password
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={submitLoginForm}
        />
      </View>
      <Text
        size={13}
        weight={500}
        lineHeight={16.9}
        color={colors.primary}
        accessibilityRole="link"
        onPress={() => navigation.navigate("ForgotPassword")}
        style={styles.forgot}
      >
        Forgot password?
      </Text>
      {error ? (
        <View style={styles.error} accessibilityRole="alert">
          <Warning20Icon />
          <Text size={12} weight={500} lineHeight={14.4}>
            {error}
          </Text>
        </View>
      ) : null}
    </AuthStep>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  fields: { gap: 24 },
  forgot: { alignSelf: "flex-start" },
  error: {
    height: 52,
    marginTop: -12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.error,
    backgroundColor: colors.errorTint,
  },
}));
