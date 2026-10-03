import { useState, type ReactNode } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";

import { STICKER_BUBBLE_WIDTH } from "./commentStickerBubble";
import { STICKER_REFERENCE_WIDTH } from "./videoReply.util";
import type { CommentStickerLayout } from "@/types";

export interface StickerPlacementProps {
  readonly layout: CommentStickerLayout;
  readonly stageWidth: number;
  readonly stageHeight: number;
  readonly children: ReactNode;
}

export function StickerPlacement({ layout, stageWidth, stageHeight, children }: StickerPlacementProps) {
  const [bubbleHeight, setBubbleHeight] = useState(64);
  const sizeFactor = (stageWidth / STICKER_REFERENCE_WIDTH) * layout.scale;
  const onLayout = (event: LayoutChangeEvent) => setBubbleHeight(event.nativeEvent.layout.height);
  return (
    <View
      onLayout={onLayout}
      style={[
        styles.anchor,
        {
          width: STICKER_BUBBLE_WIDTH,
          left: layout.x * stageWidth - STICKER_BUBBLE_WIDTH / 2,
          top: layout.y * stageHeight - bubbleHeight / 2,
          transform: [{ rotate: `${layout.rotation}deg` }, { scale: sizeFactor }],
        },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ anchor: { position: "absolute" } });
