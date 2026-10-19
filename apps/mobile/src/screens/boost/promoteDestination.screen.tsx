import type { MainScreenProps } from "@/navigation/navigation.types";
import { CreateAdScreen } from "@/screens/ads/createAd.screen";

export function PromoteDestinationScreen({ navigation, route }: MainScreenProps<"PromoteDestination">) {
  const forwardedRoute = { ...route, name: "CreateAd" as const, params: { destinationType: route.params.destinationType, targetId: route.params.targetId } };
  return <CreateAdScreen navigation={navigation as unknown as MainScreenProps<"CreateAd">["navigation"]} route={forwardedRoute} />;
}
