import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/input";
import { CalendarDots24Icon, Clock24Icon } from "@/components/icons";
import { makeThemedStyles, useTheme } from "@/theme";

function localDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function nextWeekdayAtNine(): Date {
  const next = new Date();
  const daysUntilMonday = ((8 - next.getDay()) % 7) || 7;
  next.setDate(next.getDate() + daysUntilMonday);
  next.setHours(9, 0, 0, 0);
  return next;
}

export interface SchedulePostSheetProps {
  readonly visible: boolean;
  readonly submitting: boolean;
  readonly errorMessage?: string | null;
  readonly onClose: () => void;
  readonly onSchedule: (scheduledAt: string) => void;
}

export function SchedulePostSheet({ visible, submitting, errorMessage, onClose, onSchedule }: SchedulePostSheetProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [timeValidationError, setTimeValidationError] = useState<string | null>(null);
  const [dateInput, setDateInput] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return localDateInput(tomorrow);
  });
  const [timeInput, setTimeInput] = useState("09:00");
  const { scheduledDate, preview, error } = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(timeInput)) return { scheduledDate: null, preview: null, error: "Enter a date as YYYY-MM-DD and a time as HH:MM." };
    const date = new Date(`${dateInput}T${timeInput}:00`);
    if (!Number.isFinite(date.getTime()) || localDateInput(date) !== dateInput) return { scheduledDate: null, preview: null, error: "That date and time is not valid." };
    return {
      scheduledDate: date,
      preview: new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", ...(timezone === undefined ? {} : { timeZone: timezone }) }).format(date),
      error: null,
    };
  }, [dateInput, timeInput, timezone]);
  const setShortcut = (date: Date) => {
    setTimeValidationError(null);
    setDateInput(localDateInput(date));
    setTimeInput(`${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`);
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Schedule post"
      subtitle="Your post stays private until it publishes."
      scrollable
      footer={(
        <View style={styles.footer}>
          {errorMessage ? <Text size={13} lineHeight={18} color={colors.error} accessibilityLiveRegion="polite">{errorMessage}</Text> : null}
          <Button title="Schedule post" icon={<CalendarDots24Icon size={20} color={colors.onPrimary} />} loading={submitting} disabled={submitting || scheduledDate === null} onPress={() => {
            if (scheduledDate === null) return;
            const delay = scheduledDate.getTime() - Date.now();
            if (delay < 60_000) { setTimeValidationError("Choose a time at least one minute from now."); return; }
            if (delay > 90 * 24 * 60 * 60_000) { setTimeValidationError("Posts can be scheduled up to 90 days ahead."); return; }
            onSchedule(scheduledDate.toISOString());
          }} />
        </View>
      )}
    >
      <View style={styles.content}>
        <View style={styles.shortcuts}>
          <Button title="Tomorrow, 9:00" variant="subtle" icon={<Clock24Icon size={18} color={colors.text} />} onPress={() => { const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(9, 0, 0, 0); setShortcut(tomorrow); }} />
          <Button title="Next Monday, 9:00" variant="subtle" icon={<CalendarDots24Icon size={18} color={colors.text} />} onPress={() => setShortcut(nextWeekdayAtNine())} />
        </View>
        <View style={styles.fields}>
          <TextField label="Date" left={<CalendarDots24Icon size={18} color={colors.textMuted} />} value={dateInput} onChangeText={(value) => { setDateInput(value); setTimeValidationError(null); }} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" autoCapitalize="none" maxLength={10} />
          <TextField label="Time" left={<Clock24Icon size={18} color={colors.textMuted} />} value={timeInput} onChangeText={(value) => { setTimeInput(value); setTimeValidationError(null); }} placeholder="HH:MM" keyboardType="numbers-and-punctuation" autoCapitalize="none" maxLength={5} />
        </View>
        <Text size={12} lineHeight={17} color={colors.textMuted}>Times use {timezone ?? "your device timezone"}.</Text>
        {error || timeValidationError ? <Text size={13} lineHeight={18} color={colors.error}>{error ?? timeValidationError}</Text> : preview ? <Text size={13} lineHeight={18} color={colors.text}>Will publish {preview}</Text> : null}
        <Text size={12} lineHeight={17} color={colors.textMuted}>Posts can be scheduled up to 90 days ahead. Media must finish processing before the post can publish.</Text>
      </View>
    </BottomSheet>
  );
}

const useStyles = makeThemedStyles(() => StyleSheet.create({
  content: { gap: 16, paddingBottom: 20 },
  shortcuts: { gap: 8 },
  fields: { flexDirection: "row", gap: 12 },
  footer: { gap: 10 },
}));
