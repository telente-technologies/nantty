import type { MainScreenProps } from "@/navigation/navigation.types";
import { CreateAdScreen } from "@/screens/ads/createAd.screen";

export function PromotePostScreen({ navigation, route }: MainScreenProps<"PromotePost">) {
  const forwardedRoute = { ...route, name: "CreateAd" as const, params: { destinationType: "post" as const, targetId: route.params.postId } };
  return <CreateAdScreen navigation={navigation as unknown as MainScreenProps<"CreateAd">["navigation"]} route={forwardedRoute} />;
}
