import { BookOpenText } from "phosphor-react-native";

import { StatePanel } from "../ui/StatePanel";
import { useMessengerColors } from "../ui/useMessengerColors";
import { ScreenFrame } from "../ui/ScreenFrame";

export function StoriesScreen() {
  const colors = useMessengerColors();
  return (
    <ScreenFrame title="Stories" eyebrow="NANTTY MESSENGER" backgroundColor={colors.background}>
      <StatePanel
        Icon={BookOpenText}
        title="Shared Stories are a next step"
        description="Messenger will use the same Stories and privacy rules as Nantty. Story loading, viewing, and replies are not wired in this app foundation yet."
      />
    </ScreenFrame>
  );
}
