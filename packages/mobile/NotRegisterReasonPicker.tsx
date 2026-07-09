import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import {
  NOT_REGISTER_OTHER_LABEL,
  NOT_REGISTER_REASONS,
  isPresetNotRegisterReason,
} from "./notRegisterReasons";
import { theme } from "./theme";

type Props = {
  label: string;
  hint?: string;
  value: string | null;
  onChange: (reason: string) => void;
  disabled?: boolean;
  customPlaceholder?: string;
};

export default function NotRegisterReasonPicker({
  label,
  hint,
  value,
  onChange,
  disabled,
  customPlaceholder = "اكتب سبب عدم التسجيل…",
}: Props) {
  const otherSelected = value != null && value.length > 0 && !isPresetNotRegisterReason(value);
  const selectedPreset = value && isPresetNotRegisterReason(value) ? value : null;
  const showCustomField = otherSelected || value === "";

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <View style={styles.list}>
        {NOT_REGISTER_REASONS.map((reason) => {
          const selected = selectedPreset === reason;
          return (
            <Pressable
              key={reason}
              style={[styles.row, selected && styles.rowOn]}
              onPress={() => onChange(reason)}
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
          style={[styles.row, (otherSelected || value === "") && styles.rowOn]}
          onPress={() => {
            if (!otherSelected && value !== "") onChange("");
          }}
          disabled={disabled}
        >
          <View style={[styles.radio, (otherSelected || value === "") && styles.radioOn]}>
            {otherSelected || value === "" ? <View style={styles.radioDot} /> : null}
          </View>
          <Text style={[styles.text, (otherSelected || value === "") && styles.textOn]}>
            {NOT_REGISTER_OTHER_LABEL}
          </Text>
        </Pressable>
      </View>
      {showCustomField ? (
        <TextInput
          style={styles.customInput}
          value={otherSelected || value === "" ? value ?? "" : ""}
          onChangeText={onChange}
          placeholder={customPlaceholder}
          placeholderTextColor={theme.muted}
          textAlign="right"
          editable={!disabled}
          multiline
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
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: theme.radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "#fff",
    color: theme.text,
    fontSize: 14,
    minHeight: 48,
  },
});
