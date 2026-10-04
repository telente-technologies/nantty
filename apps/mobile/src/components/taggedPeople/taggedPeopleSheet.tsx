import { BottomSheet } from "@/components/ui/bottomSheet";
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
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Tagged in this clip" subtitle={`${formatCompactCount(total)} ${total === 1 ? "person" : "people"}`} scrollable>
      <TaggedPeopleList post={post} visible={visible} onClose={onClose} />
    </BottomSheet>
  );
}
