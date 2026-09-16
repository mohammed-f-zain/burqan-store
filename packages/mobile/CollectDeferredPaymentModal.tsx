import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { theme } from "./theme";

export type CollectDeferredLabels = {
  title: string;
  outstanding: (amount: string) => string;
  amount: string;
  note: string;
  notePlaceholder: string;
  submit: string;
  cancel: string;
  invalidAmount: string;
  amountTooHigh?: string;
};

type Props = {
  visible: boolean;
  storeName: string;
  outstanding: number;
  busy?: boolean;
  serverError?: string | null;
  labels: CollectDeferredLabels;
  formatMoney: (n: number) => string;
  onClose: () => void;
  onSubmit: (payload: { amount: number; note?: string }) => void;
};

/** Parse amounts typed with Arabic/Persian digits or ، / ٫ decimals. */
export function parseMoneyInput(raw: string): number {
  const normalized = String(raw ?? "")
    .trim()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[٫،]/g, ".")
    .replace(/,/g, ".")
    .replace(/\s+/g, "")
    .replace(/[^\d.]/g, "");
  if (!normalized) return NaN;
  const firstDot = normalized.indexOf(".");
  const cleaned =
    firstDot === -1
      ? normalized
      : normalized.slice(0, firstDot + 1) + normalized.slice(firstDot + 1).replace(/\./g, "");
  return parseFloat(cleaned);
}

export default function CollectDeferredPaymentModal(props: Props) {
  const { visible, storeName, outstanding, busy, serverError, labels, formatMoney } = props;
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setAmount(outstanding > 0 ? String(Number(outstanding.toFixed(2))) : "");
      setNote("");
      setError(null);
    }
  }, [visible, outstanding]);

  const shownError = error || serverError || null;

  function submit() {
    Keyboard.dismiss();
    const n = parseMoneyInput(amount);
    if (!Number.isFinite(n) || n <= 0) {
      setError(labels.invalidAmount);
      return;
    }
    if (n > outstanding + 0.004) {
      setError(labels.amountTooHigh ?? labels.invalidAmount);
      return;
    }
    setError(null);
    props.onSubmit({ amount: n, note: note.trim() || undefined });
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={props.onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        pointerEvents="box-none"
      >
        <Pressable style={styles.backdropTouch} onPress={props.onClose} accessibilityLabel={labels.cancel} />
        <SafeAreaView style={styles.sheetWrap} edges={["bottom"]} pointerEvents="box-none">
          <View style={styles.sheet} pointerEvents="auto">
            <View style={styles.handle} />
            <Text style={styles.title}>{labels.title}</Text>
            <Text style={styles.storeName}>{storeName}</Text>
            <Text style={styles.outstanding}>{labels.outstanding(formatMoney(outstanding))}</Text>

            <Text style={styles.label}>{labels.amount}</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={(v) => {
                setAmount(v);
                if (error) setError(null);
              }}
              keyboardType="decimal-pad"
              textAlign="right"
              editable={!busy}
              returnKeyType="done"
              onSubmitEditing={submit}
            />

            <Text style={styles.label}>{labels.note}</Text>
            <TextInput
              style={styles.input}
              value={note}
              onChangeText={setNote}
              placeholder={labels.notePlaceholder}
              placeholderTextColor={theme.muted}
              textAlign="right"
              editable={!busy}
            />

            {shownError ? <Text style={styles.errorText}>{shownError}</Text> : null}

            <Pressable
              style={[styles.submit, busy && styles.disabled]}
              onPress={submit}
              disabled={!!busy}
              accessibilityRole="button"
              accessibilityLabel={labels.submit}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="cash-outline" size={20} color="#fff" />
                  <Text style={styles.submitText}>{labels.submit}</Text>
                </>
              )}
            </Pressable>
            <Pressable style={styles.cancel} onPress={props.onClose} disabled={!!busy}>
              <Text style={styles.cancelText}>{labels.cancel}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.55)",
  },
  backdropTouch: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  sheetWrap: { width: "100%", zIndex: 1 },
  sheet: {
    backgroundColor: theme.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderWidth: 1,
    borderColor: theme.line,
    ...theme.shadow.float,
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#cbd5e1",
    marginTop: 10,
    marginBottom: 12,
  },
  title: { color: theme.text, fontSize: 18, fontWeight: "800", textAlign: "center" },
  storeName: { color: theme.muted, fontSize: 14, textAlign: "center", marginTop: 6 },
  outstanding: {
    color: theme.accentDark,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 10,
    marginBottom: 16,
  },
  label: { color: theme.muted, fontWeight: "700", textAlign: "right", marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: theme.line,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.text,
    backgroundColor: "#f8fafc",
    marginBottom: 12,
  },
  errorText: {
    color: "#b91c1c",
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
    fontSize: 14,
  },
  submit: {
    marginTop: 8,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: theme.accent,
    paddingVertical: 14,
    borderRadius: theme.radius.lg,
  },
  submitText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  cancel: { paddingVertical: 12, alignItems: "center" },
  cancelText: { color: theme.muted, fontWeight: "700" },
  disabled: { opacity: 0.55 },
});
