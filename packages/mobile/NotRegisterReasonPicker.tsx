import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import {
  NOT_REGISTER_REASON_OTHER,
  NOT_REGISTER_REASONS,
  isPresetNotRegisterReason,
  isValidProspectReason,
} from "./notRegisterReasons";
import { theme } from "./theme";

type Props = {
  label: string;
  hint?: string;
  customPlaceholder?: string;
  value: string | null;
  onChange: (reason: string) => void;
  disabled?: boolean;
};

export default function NotRegisterReasonPicker({
  label,
  hint,
  customPlaceholder,
  value,
  onChange,
  disabled,
}: Props) {
  const [customMode, setCustomMode] = useState(() => Boolean(value && !isPresetNotRegisterReason(value)));
  const [customText, setCustomText] = useState(() =>
    value && !isPresetNotRegisterReason(value) ? value : ""
  );

  useEffect(() => {
    if (value && !isPresetNotRegisterReason(value)) {
      setCustomMode(true);
      setCustomText(value);
    } else if (value && isPresetNotRegisterReason(value)) {
      setCustomMode(false);
    }
  }, [value]);

  function selectPreset(reason: string) {
    setCustomMode(false);
    setCustomText("");
    onChange(reason);
  }

  function selectCustomMode() {
    setCustomMode(true);
    if (isValidProspectReason(customText)) onChange(customText.trim());
  }

  function onCustomTextChange(text: string) {
    setCustomText(text);
    const trimmed = text.trim();
    if (trimmed.length >= 2) onChange(trimmed);
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <View style={styles.list}>
        {NOT_REGISTER_REASONS.map((reason) => {
          const selected = !customMode && value === reason;
          return (
            <Pressable
              key={reason}
              style={[styles.row, selected && styles.rowOn]}
              onPress={() => selectPreset(reason)}
              disabled={disabled}
            >
              <View style={[styles.radio, selected && styles.radioOn]}>
                {selected ? <View style={styles.radioDot} /> : null}
              </View>
              <Text style={[styles.text, selected && styles.textOn]}>{reason}</Text>
            </Pressable>
          );
        })}
        <Pressable
          style={[styles.row, customMode && styles.rowOn]}
          onPress={() => selectCustomMode()}
          disabled={disabled}
        >
          <View style={[styles.radio, customMode && styles.radioOn]}>
            {customMode ? <View style={styles.radioDot} /> : null}
          </View>
          <Text style={[styles.text, customMode && styles.textOn]}>{NOT_REGISTER_REASON_OTHER}</Text>
        </Pressable>
      </View>
      {customMode ? (
        <TextInput
          style={styles.customInput}
          value={customText}
          onChangeText={onCustomTextChange}
          placeholder={customPlaceholder ?? "اكتب السبب هنا…"}
          placeholderTextColor={theme.muted}
          multiline
          textAlign="right"
          textAlignVertical="top"
          editable={!disabled}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12 },
  label: { color: theme.muted, fontSize: 13, fontWeight: "700", textAlign: "right", marginBottom: 6 },
  hint: { color: theme.muted, fontSize: 12, textAlign: "right", marginBottom: 10, lineHeight: 18 },
  list: { gap: 8 },
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: theme.line,
    backgroundColor: "#f8fafc",
  },
  rowOn: { borderColor: theme.accent, backgroundColor: theme.accentSoft },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: theme.line,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { borderColor: theme.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.accent },
  text: { flex: 1, color: theme.text, fontSize: 14, fontWeight: "600", textAlign: "right", lineHeight: 20 },
  textOn: { color: theme.accentDark, fontWeight: "800" },
  customInput: {
    marginTop: 10,
    minHeight: 88,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#fff",
    color: theme.text,
    fontSize: 14,
    lineHeight: 20,
  },
});
