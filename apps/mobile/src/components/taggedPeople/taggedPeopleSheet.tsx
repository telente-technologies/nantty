import { View } from "react-native";

import { UserPlus24Icon } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { useTheme } from "@/theme";
import type { Post } from "@/types";
import { formatCompactCount } from "@/utils/formatCount.util";

import { countTaggedPeople } from "./taggedPeople.hook";
import { TaggedPeopleList } from "./taggedPeopleList";

export interface TaggedPeopleSheetProps {
  readonly post: Pick<Post, "id" | "taggedUsers" | "taggedUsersCount">;
  readonly visible: boolean;
  readonly onClose: () => void;
}

export function TaggedPeopleSheet({ post, visible, onClose }: TaggedPeopleSheetProps) {
  const total = countTaggedPeople(post);
  const { colors } = useTheme();
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Tagged in this clip" subtitle={`${formatCompactCount(total)} ${total === 1 ? "person" : "people"}`} scrollable>
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.chip }}>
          <UserPlus24Icon size={22} color={colors.textMuted} />
        </View>
      </View>
      <TaggedPeopleList post={post} visible={visible} onClose={onClose} />
    </BottomSheet>
  );
}
