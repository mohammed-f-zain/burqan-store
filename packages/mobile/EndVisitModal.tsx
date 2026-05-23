import { useEffect, useState } from "react";
import {
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

export type EndVisitLabels = {
  title: string;
  message: string;
  messageCart: (n: number) => string;
  noteLabel: string;
  notePlaceholder: string;
  stay: string;
  goCart: string;
  confirm: string;
};

type Props = {
  visible: boolean;
  cartItemCount: number;
  busy?: boolean;
  labels: EndVisitLabels;
  onStay: () => void;
  onGoCart: () => void;
  onConfirm: (note: string) => void;
};

export default function EndVisitModal(props: Props) {
  const { visible, cartItemCount, busy, labels } = props;
  const [note, setNote] = useState("");

  useEffect(() => {
    if (visible) setNote("");
  }, [visible]);

  const message = cartItemCount > 0 ? labels.messageCart(cartItemCount) : labels.message;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={props.onStay}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={styles.backdropTouch} onPress={props.onStay} />
        <SafeAreaView style={styles.sheetWrap} edges={["bottom"]}>
          <View style={styles.sheet}>
            <Text style={styles.title}>{labels.title}</Text>
            <Text style={styles.message}>{message}</Text>

            <Text style={styles.noteLabel}>{labels.noteLabel}</Text>
            <TextInput
              style={styles.noteInput}
              value={note}
              onChangeText={setNote}
              placeholder={labels.notePlaceholder}
              placeholderTextColor={theme.muted}
              multiline
              textAlignVertical="top"
              textAlign="right"
              editable={!busy}
            />

            <View style={styles.actions}>
              <Pressable style={styles.stayBtn} onPress={props.onStay} disabled={busy}>
                <Text style={styles.stayBtnText}>{labels.stay}</Text>
              </Pressable>
              {cartItemCount > 0 ? (
                <Pressable style={styles.secondaryBtn} onPress={props.onGoCart} disabled={busy}>
                  <Text style={styles.secondaryBtnText}>{labels.goCart}</Text>
                </Pressable>
              ) : null}
              <Pressable
                style={[styles.confirmBtn, busy && styles.btnDisabled]}
                onPress={() => props.onConfirm(note.trim())}
                disabled={busy}
              >
                <Text style={styles.confirmBtnText}>{labels.confirm}</Text>
              </Pressable>
            </View>
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
    backgroundColor: "rgba(15, 23, 42, 0.45)",
  },
  backdropTouch: { ...StyleSheet.absoluteFillObject },
  sheetWrap: { width: "100%" },
  sheet: {
    backgroundColor: theme.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderWidth: 1,
    borderColor: theme.line,
  },
  title: {
    color: theme.text,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "right",
    marginBottom: 8,
  },
  message: {
    color: theme.muted,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "right",
    marginBottom: 16,
  },
  noteLabel: {
    color: theme.muted,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "right",
    marginBottom: 8,
  },
  noteInput: {
    minHeight: 88,
    maxHeight: 140,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.text,
    backgroundColor: "#f8fafc",
    marginBottom: 16,
  },
  actions: { gap: 10 },
  stayBtn: {
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: theme.radius.md,
    backgroundColor: "#f1f5f9",
  },
  stayBtnText: { color: theme.text, fontWeight: "700", fontSize: 16 },
  secondaryBtn: {
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.accent,
    backgroundColor: theme.accentSoft,
  },
  secondaryBtnText: { color: theme.accentDark, fontWeight: "700", fontSize: 16 },
  confirmBtn: {
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: theme.radius.md,
    backgroundColor: theme.danger,
  },
  confirmBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  btnDisabled: { opacity: 0.6 },
});
