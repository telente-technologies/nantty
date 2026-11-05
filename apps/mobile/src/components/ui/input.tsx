import { forwardRef, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, TextInput, View, type StyleProp, type TextInputInstance, type TextInputProps, type ViewStyle } from "react-native";

import { EyeClosed20Icon, Eye20Icon } from "@/components/icons";
import { makeThemedStyles, useTheme } from "@/theme";
import { fontFamily, calculateDefaultLetterSpacing } from "@/constants/typography.constant";

import { Text } from "./text";

export interface TextFieldProps extends Omit<TextInputProps, "style"> {
  readonly label?: string;
  readonly password?: boolean;
  readonly right?: ReactNode;
  readonly left?: ReactNode;
  readonly invalid?: boolean;
  readonly style?: StyleProp<ViewStyle>;
  readonly boxStyle?: StyleProp<ViewStyle>;
}

export const TextField = forwardRef<TextInputInstance, TextFieldProps>(function TextField(
  { label, password, right, left, invalid, style, boxStyle, onFocus, onBlur, ...props },
  ref,
) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const borderColor = invalid ? colors.error : focused ? colors.primary : colors.textSubtle;
  return (
    <View style={[styles.field, style]}>
      {label ? (
        <Text size={14} lineHeight={16.8}>
          {label}
        </Text>
      ) : null}
      <View style={[styles.box, { borderColor }, boxStyle]}>
        {left}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textSubtle}
          selectionColor={colors.primary}
          cursorColor={colors.primary}
          secureTextEntry={password && hidden}
          autoCapitalize={password ? "none" : props.autoCapitalize}
          autoCorrect={password ? false : props.autoCorrect}
          {...props}
          accessibilityLabel={props.accessibilityLabel ?? label}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={styles.input}
        />
        {password ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? "Show password" : "Hide password"}
            hitSlop={10}
            onPress={() => setHidden((h) => !h)}
          >
            {!props.value ? <Eye20Icon /> : hidden ? <EyeClosed20Icon /> : <Eye20Icon color={colors.text} />}
          </Pressable>
        ) : null}
        {right}
      </View>
    </View>
  );
});

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  field: { gap: 8 },
  box: {
    height: 42,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  input: {
    flex: 1,
    height: "100%",
    padding: 0,
    fontFamily: fontFamily[400],
    fontSize: 14,
    letterSpacing: calculateDefaultLetterSpacing(14),
    color: colors.text,
  },
}));
