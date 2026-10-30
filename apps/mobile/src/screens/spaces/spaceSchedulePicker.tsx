import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { CalendarDots24Icon, CaretLeft16Icon, CaretRight16Icon, Clock24Icon, Microphone24Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { makeThemedStyles, useTheme } from "@/theme";

export function SpaceSchedulePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [now] = useState(() => Date.now());
  const date = value ? new Date(value) : new Date(now + 86400000);
  const [month, setMonth] = useState(
    new Date(date.getFullYear(), date.getMonth(), 1),
  );
  const selectDay = (day: number) => {
    const next = new Date(
      month.getFullYear(),
      month.getMonth(),
      day,
      date.getHours(),
      date.getMinutes(),
    );
    onChange(next.toISOString());
  };
  const times = Array.from({ length: 48 }, (_, index) => ({
    hour: Math.floor(index / 2),
    minute: (index % 2) * 30,
  }));
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return (
    <View style={styles.section}>
      <View style={styles.tabs}>
        {[
          { label: "Start now", icon: <Microphone24Icon size={20} color={value ? colors.textMuted : colors.primary} />, selected: !value, onPress: () => onChange("") },
          {
            label: "Schedule",
            icon: <CalendarDots24Icon size={20} color={value ? colors.primary : colors.textMuted} />,
            selected: !!value,
            onPress: () => {
              if (!value) {
                const next = new Date(Date.now() + 86400000);
                next.setHours(18, 0, 0, 0);
                onChange(next.toISOString());
              }
              setOpen(true);
            },
          },
        ].map((item) => (
          <Pressable
            key={item.label}
            accessibilityRole="radio"
            accessibilityState={{ checked: item.selected }}
            onPress={item.onPress}
            style={[styles.tab, item.selected && styles.selected]}
          >
            {item.icon}
            <Text weight={600} color={item.selected ? colors.primary : colors.text}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
      {!!value && (
        <Button
          variant="outline"
          icon={<CalendarDots24Icon size={20} color={colors.primary} />}
          title={date.toLocaleString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
          onPress={() => setOpen(true)}
        />
      )}
      <Modal
        visible={open}
        transparent
        animationType="none"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.overlay}>
          <View accessibilityViewIsModal style={styles.sheet}>
            <Text size={22} weight={700}>
              When should we meet?
            </Text>
            <View style={styles.month}>
              <Pressable accessibilityRole="button" accessibilityLabel="Previous month" style={styles.monthArrow} onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
                <CaretLeft16Icon size={20} color={colors.text} />
              </Pressable>
              <Text weight={700}>
                {month.toLocaleDateString(undefined, {
                  month: "long",
                  year: "numeric",
                })}
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Next month" style={styles.monthArrow} onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
                <CaretRight16Icon size={20} color={colors.text} />
              </Pressable>
            </View>
            <View style={styles.calendar}>
              {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                <View key={index} style={styles.day}>
                  <Text size={12} color={colors.textMuted}>
                    {day}
                  </Text>
                </View>
              ))}
              {Array.from({ length: month.getDay() }, (_, index) => (
                <View key={`empty-${index}`} style={styles.day} />
              ))}
              {Array.from({ length: days }, (_, index) => index + 1).map(
                (day) => {
                  const selected =
                    date.getFullYear() === month.getFullYear() &&
                    date.getMonth() === month.getMonth() &&
                    date.getDate() === day;
                  const expired =
                    new Date(
                      month.getFullYear(),
                      month.getMonth(),
                      day,
                      23,
                      59,
                    ).getTime() < now;
                  return (
                    <Pressable
                      key={day}
                      disabled={expired}
                      accessibilityRole="button"
                      accessibilityLabel={new Date(
                        month.getFullYear(),
                        month.getMonth(),
                        day,
                      ).toLocaleDateString(undefined, { dateStyle: "full" })}
                      accessibilityState={{ selected, disabled: expired }}
                      style={[styles.day, selected && styles.selected]}
                      onPress={() => selectDay(day)}
                    >
                      <Text
                        color={
                          expired
                            ? colors.textSubtle
                            : selected
                              ? colors.primary
                              : colors.text
                        }
                        weight={selected ? 700 : 400}
                      >
                        {day}
                      </Text>
                    </Pressable>
                  );
                },
              )}
            </View>
            <View style={styles.timeHeading}><Clock24Icon size={18} color={colors.textMuted} /><Text weight={600}>Choose a time</Text></View>
            <Text size={12} color={colors.textMuted}>
              Your local time ·{" "}
              {Intl.DateTimeFormat().resolvedOptions().timeZone}
            </Text>
            <ScrollView
              style={styles.times}
              contentContainerStyle={styles.timeGrid}
            >
              {times.map((time) => {
                const display = new Date(date);
                display.setHours(time.hour, time.minute, 0, 0);
                const selected =
                  date.getHours() === time.hour &&
                  date.getMinutes() === time.minute;
                return (
                  <Pressable
                    key={time.hour * 60 + time.minute}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => onChange(display.toISOString())}
                    style={[styles.time, selected && styles.selected]}
                  >
                    <Text
                      size={13}
                      color={selected ? colors.primary : colors.text}
                    >
                      {display.toLocaleTimeString(undefined, {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Button title="Done" icon={<CalendarDots24Icon size={20} color={colors.onPrimary} />} onPress={() => setOpen(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}
const useStyles = makeThemedStyles((colors) =>
  StyleSheet.create({
    section: { gap: 12 },
    tabs: { flexDirection: "row", gap: 8 },
    tab: {
      flex: 1,
      minHeight: 48,
      paddingHorizontal: 8,
      flexDirection: "row",
      gap: 8,
      borderWidth: 1,
      borderColor: colors.divider,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    selected: { backgroundColor: colors.primaryTint, borderRadius: 10 },
    overlay: {
      flex: 1,
      backgroundColor: "#00000066",
      justifyContent: "center",
      padding: 16,
    },
    sheet: {
      width: "100%",
      maxWidth: 520,
      maxHeight: "95%",
      alignSelf: "center",
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 18,
      gap: 14,
    },
    month: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    monthArrow: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22 },
    timeHeading: { flexDirection: "row", alignItems: "center", gap: 8 },
    calendar: { flexDirection: "row", flexWrap: "wrap" },
    day: {
      width: "14.2857%",
      minHeight: 38,
      alignItems: "center",
      justifyContent: "center",
    },
    times: { maxHeight: 160 },
    timeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    time: {
      width: "30%",
      minHeight: 44,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.divider,
      alignItems: "center",
      justifyContent: "center",
    },
  }),
);
