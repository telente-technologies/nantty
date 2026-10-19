import { useMemo, useRef } from "react";
import { PanResponder, StyleSheet, View } from "react-native";

import { Microphone24Icon } from "@/components/icons";

export interface VoiceNoteMicrophoneButtonProps {
  readonly onHoldStart: () => void;
  readonly onDrag: (dragLeftPx: number) => void;
  readonly onRelease: () => void;
  readonly onInterrupt: () => void;
  readonly onRecordHandsFree: () => void;
}

export function VoiceNoteMicrophoneButton(props: VoiceNoteMicrophoneButtonProps) {
  const latestProps = useRef(props);
  latestProps.current = props;
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: () => latestProps.current.onHoldStart(),
        onPanResponderMove: (_, gesture) => latestProps.current.onDrag(Math.max(0, -gesture.dx)),
        onPanResponderRelease: () => latestProps.current.onRelease(),
        onPanResponderTerminate: () => latestProps.current.onInterrupt(),
      }),
    [],
  );
  return (
    <View
      {...responder.panHandlers}
      hitSlop={10}
      style={styles.button}
      accessible
      accessibilityRole="button"
      accessibilityLabel="Hold to record a voice note"
      accessibilityHint="Double-tap to record hands-free"
      accessibilityActions={[{ name: "activate", label: "Record hands-free" }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "activate") props.onRecordHandsFree();
      }}
    >
      <Microphone24Icon />
    </View>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: "center", justifyContent: "center" },
});
