import { KeyboardAwareForm } from "@/components/ui/keyboardAwareForm";
import { Text } from "@/components/ui/text";
import type { SpaceCreationFormProps } from "./spaceCreationForm";
import { SpaceCreationForm } from "./spaceCreationForm";
import type { SpacesDirectoryContentProps } from "./spacesDirectoryContent";
import { SpacesDirectoryContent } from "./spacesDirectoryContent";
import type { SpaceRoomContentProps } from "./spaceRoomContent";
import { SpaceRoomContent } from "./spaceRoomContent";
import type { useSpacesStyles } from "./spaces.styles";

type SpaceStyles = ReturnType<typeof useSpacesStyles>;

export interface SpacesScreenBodyProps {
  readonly styles: SpaceStyles;
  readonly message: string;
  readonly creating: boolean;
  readonly hasSpaceId: boolean;
  readonly creationProps: Omit<SpaceCreationFormProps, "styles">;
  readonly roomProps: Omit<SpaceRoomContentProps, "styles">;
  readonly directoryProps: Omit<SpacesDirectoryContentProps, "styles">;
}

export function SpacesScreenBody({
  styles,
  message,
  creating,
  hasSpaceId,
  creationProps,
  roomProps,
  directoryProps,
}: SpacesScreenBodyProps) {
  return (
    <KeyboardAwareForm
      style={styles.scroll}
      contentContainerStyle={styles.content}
      safeAreaHandledByParent
    >
      {message ? (
        <Text accessibilityRole="alert" style={styles.notice}>{message}</Text>
      ) : null}
      {creating ? (
        <SpaceCreationForm styles={styles} {...creationProps} />
      ) : hasSpaceId ? (
        <SpaceRoomContent styles={styles} {...roomProps} />
      ) : (
        <SpacesDirectoryContent styles={styles} {...directoryProps} />
      )}
    </KeyboardAwareForm>
  );
}
