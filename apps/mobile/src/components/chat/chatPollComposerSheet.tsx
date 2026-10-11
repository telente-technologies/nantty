import { useState } from "react";
import { Pressable, StyleSheet, Switch, View } from "react-native";

import { Plus16Icon } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";

import type { OutgoingPollDraft } from "./optimisticLocationAndPollSender.hook";

const MINIMUM_POLL_OPTIONS = 2;
const MAXIMUM_POLL_OPTIONS = 6;
const MAXIMUM_QUESTION_LENGTH = 120;
const MAXIMUM_OPTION_LENGTH = 60;

export interface ChatPollComposerSheetProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly onSendPoll: (poll: OutgoingPollDraft) => void;
}

export function ChatPollComposerSheet({ visible, onClose, onSendPoll }: ChatPollComposerSheetProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [question, setQuestion] = useState("");
  const [optionTexts, setOptionTexts] = useState<string[]>(["", ""]);
  const [allowMultipleAnswers, setAllowMultipleAnswers] = useState(false);
  const filledOptions = optionTexts.map((text) => text.trim()).filter(Boolean);
  const hasDuplicateOptions = new Set(filledOptions.map((text) => text.toLowerCase())).size !== filledOptions.length;
  const canSend = question.trim().length > 0 && filledOptions.length >= MINIMUM_POLL_OPTIONS && !hasDuplicateOptions;

  const changeOption = (index: number, text: string) => setOptionTexts((current) => current.map((existing, position) => (position === index ? text : existing)));

  const send = () => {
    onSendPoll({ question: question.trim(), allowMultipleAnswers, options: filledOptions });
    setQuestion("");
    setOptionTexts(["", ""]);
    setAllowMultipleAnswers(false);
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Create poll" scrollable>
      <View style={styles.body}>
        <TextField label="Question" value={question} onChangeText={setQuestion} maxLength={MAXIMUM_QUESTION_LENGTH} placeholder="Ask something" />
        {optionTexts.map((text, index) => (
          <TextField
            key={index}
            label={`Option ${index + 1}`}
            value={text}
            onChangeText={(next) => changeOption(index, next)}
            maxLength={MAXIMUM_OPTION_LENGTH}
            invalid={hasDuplicateOptions && !!text.trim() && filledOptions.filter((option) => option.toLowerCase() === text.trim().toLowerCase()).length > 1}
          />
        ))}
        {hasDuplicateOptions ? <Text size={12} lineHeight={15.6} color={colors.error}>Each option must be different.</Text> : null}
        {optionTexts.length < MAXIMUM_POLL_OPTIONS ? (
          <Pressable accessibilityRole="button" onPress={() => setOptionTexts((current) => [...current, ""])} style={styles.addOption}>
            <Plus16Icon color={colors.primary} />
            <Text size={14} weight={600} lineHeight={18.2} color={colors.primary}>Add option</Text>
          </Pressable>
        ) : null}
        <View style={styles.switchRow}>
          <Text size={14} lineHeight={18.2}>Allow multiple answers</Text>
          <Switch accessibilityLabel="Allow multiple answers" value={allowMultipleAnswers} onValueChange={setAllowMultipleAnswers} trackColor={{ true: colors.primary }} />
        </View>
        <Button title="Send poll" disabled={!canSend} onPress={send} />
      </View>
    </BottomSheet>
  );
}

const useStyles = makeThemedStyles(() => StyleSheet.create({
  body: { paddingBottom: 12, gap: 12 },
  addOption: { flexDirection: "row", alignItems: "center", gap: 8 },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
}));
