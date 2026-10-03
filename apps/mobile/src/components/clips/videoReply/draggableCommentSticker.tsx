import { useRef } from "react";
import { PanResponder, View, type GestureResponderEvent } from "react-native";

import type { CommentStickerLayout } from "@/types";

import { CommentStickerBubble, type CommentStickerBubbleProps } from "./commentStickerBubble";
import { StickerPlacement } from "./stickerPlacement";
import { clampStickerLayout } from "./videoReply.util";

export interface DraggableCommentStickerProps extends CommentStickerBubbleProps {
  readonly layout: CommentStickerLayout;
  readonly stageWidth: number;
  readonly stageHeight: number;
  readonly onChangeLayout: (layout: CommentStickerLayout) => void;
}

const measurePinch = (event: GestureResponderEvent) => {
  const [a, b] = event.nativeEvent.touches;
  if (!a || !b) return null;
  const dx = b.pageX - a.pageX;
  const dy = b.pageY - a.pageY;
  return { distance: Math.hypot(dx, dy), angle: (Math.atan2(dy, dx) * 180) / Math.PI };
};

export function DraggableCommentSticker({ layout, stageWidth, stageHeight, onChangeLayout, ...bubble }: DraggableCommentStickerProps) {
  const latest = useRef({ layout, stageWidth, stageHeight, onChangeLayout });
  latest.current = { layout, stageWidth, stageHeight, onChangeLayout };
  const start = useRef(layout);
  const pinch = useRef<{ distance: number; angle: number; scale: number; rotation: number } | null>(null);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        start.current = latest.current.layout;
        pinch.current = null;
      },
      onPanResponderMove: (event, gesture) => {
        const current = latest.current;
        const measured = measurePinch(event);
        if (measured) {
          if (!pinch.current) {
            pinch.current = { ...measured, scale: current.layout.scale, rotation: current.layout.rotation };
            return;
          }
          current.onChangeLayout(
            clampStickerLayout({
              ...current.layout,
              scale: pinch.current.scale * (measured.distance / pinch.current.distance),
              rotation: pinch.current.rotation + (measured.angle - pinch.current.angle),
            }),
          );
          return;
        }
        if (pinch.current) return;
        current.onChangeLayout(
          clampStickerLayout({
            ...current.layout,
            x: start.current.x + gesture.dx / current.stageWidth,
            y: start.current.y + gesture.dy / current.stageHeight,
          }),
        );
      },
      onPanResponderRelease: () => {
        pinch.current = null;
      },
      onPanResponderTerminate: () => {
        pinch.current = null;
      },
    }),
  ).current;

  return (
    <StickerPlacement layout={layout} stageWidth={stageWidth} stageHeight={stageHeight}>
      <View {...responder.panHandlers} accessibilityHint="Drag to move, pinch to resize and rotate">
        <CommentStickerBubble {...bubble} />
      </View>
    </StickerPlacement>
  );
}
