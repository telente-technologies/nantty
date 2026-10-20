import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";

import { BrandLoader } from "@/components/ui/brandLoader";
import { ErrorState } from "@/components/ui/errorState";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { usersService } from "@/services/account/users.service";

export function UserProfileByUsernameScreen({ navigation, route }: MainScreenProps<"UserProfileByUsername">) {
  const username = route.params.username.replace(/^@/, "");
  const lookup = useQuery({ queryKey: ["user-by-username", username.toLowerCase()], queryFn: () => usersService.fetchUserIdByUsername(username), retry: false });

  useEffect(() => {
    if (lookup.data) navigation.replace("UserProfile", { userId: lookup.data.id });
  }, [lookup.data, navigation]);

  return (
    <Screen>
      <Header title={`@${username}`} />
      {lookup.isError ? (
        <ErrorState error={lookup.error} message="This account doesn't exist or has been renamed." onRetry={() => lookup.refetch()} />
      ) : (
        <View style={styles.center} accessibilityLabel="Opening profile">
          <BrandLoader size="lg" />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({ center: { flex: 1, alignItems: "center", justifyContent: "center" } });
