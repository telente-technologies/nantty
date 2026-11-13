import { View } from "react-native";
import {
  Broadcast24Icon,
  Coin24Icon,
  Headset24Icon,
  Microphone24Icon,
  MicrophoneSlash24Icon,
  SignOut24Icon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import type { SpaceDetails, SpaceJoinGrant } from "@/services/spaces.service";
import { useTheme } from "@/theme";
import type { useSpacesStyles } from "./spaces.styles";
import type { SpaceAudioConnection } from "./useSpaceAudioConnection.hook";

type SpaceStyles = ReturnType<typeof useSpacesStyles>;

export interface SpaceRoomControlsProps {
  readonly styles: SpaceStyles;
  readonly space: SpaceDetails;
  readonly host: boolean;
  readonly busy: boolean;
  readonly grant: SpaceJoinGrant | null;
  readonly audio: SpaceAudioConnection;
  readonly onJoin: () => void;
  readonly onRequestToSpeak: () => void;
  readonly onDonate: () => void;
  readonly onExit: () => void;
  readonly onStart: () => void;
}

export function SpaceRoomControls({
  styles,
  space,
  host,
  busy,
  grant,
  audio,
  onJoin,
  onRequestToSpeak,
  onDonate,
  onExit,
  onStart,
}: SpaceRoomControlsProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.bottomBar}>
      <View style={styles.bottomInner}>
        {space.state === "live" ? (
          <>
            {!grant ? (
              <Button
                title={host ? "Connect" : "Join"}
                accessibilityLabel={host ? "Connect host audio" : "Join as listener"}
                icon={<Headset24Icon size={20} color={colors.onPrimary} />}
                disabled={busy}
                loading={busy}
                onPress={onJoin}
                style={styles.control}
              />
            ) : (
              <>
                {audio.canPublish ? (
                  <Button
                    title={audio.isMuted ? "Unmute" : "Mute"}
                    accessibilityLabel={audio.isMuted ? "Unmute microphone" : "Mute microphone"}
                    icon={audio.isMuted
                      ? <Microphone24Icon size={20} color={colors.onPrimary} />
                      : <MicrophoneSlash24Icon size={20} color={colors.onPrimary} />}
                    disabled={audio.status !== "connected"}
                    onPress={() => { void audio.toggleMicrophone(); }}
                    style={styles.control}
                  />
                ) : (
                  <Button
                    title={space.speakerRequestState === "pending" ? "Requested" : "Ask to speak"}
                    variant="outline"
                    icon={<Microphone24Icon size={18} color={colors.text} />}
                    disabled={busy || space.speakerRequestState === "pending" || grant.demo}
                    onPress={onRequestToSpeak}
                    style={styles.control}
                  />
                )}
                {!host && space.giftsEnabled ? (
                  <Button
                    title="Support host"
                    accessibilityLabel={`Donate coins to ${space.host.name}`}
                    variant="outline"
                    icon={<Coin24Icon size={18} color={colors.text} />}
                    onPress={onDonate}
                    style={styles.control}
                  />
                ) : null}
                <Button
                  title={host ? "End" : "Leave"}
                  accessibilityLabel={host ? "End Space" : "Leave Space"}
                  variant={host ? "danger" : "outline"}
                  icon={host
                    ? <Broadcast24Icon size={18} color={colors.error} />
                    : <SignOut24Icon size={18} color={colors.text} />}
                  disabled={busy}
                  onPress={onExit}
                  style={styles.exitControl}
                />
              </>
            )}
          </>
        ) : space.state === "scheduled" && host ? (
          <Button
            title="Start now"
            icon={<Broadcast24Icon size={20} color={colors.onPrimary} />}
            disabled={busy}
            onPress={onStart}
            style={styles.control}
          />
        ) : (
          <Text color={colors.textMuted}>
            {space.state === "scheduled"
              ? "Come back when the conversation starts."
              : "This Space is closed."}
          </Text>
        )}
      </View>
    </View>
  );
}
