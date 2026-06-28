import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { NO_BUY_REASONS } from "./noBuyReasons";
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
  pickReasonHint?: string;
  modeVisitNote?: string;
  modeNoBuy?: string;
};

type Props = {
  visible: boolean;
  cartItemCount: number;
  noBuyReasonRequired?: boolean;
  busy?: boolean;
  labels: EndVisitLabels;
  onStay: () => void;
  onGoCart: () => void;
  onConfirm: (payload: { note: string; kind: "visit-note" | "no-buy-reason" }) => void;
};

export default function EndVisitModal(props: Props) {
  const { visible, cartItemCount, noBuyReasonRequired, busy, labels } = props;
  const [note, setNote] = useState("");
  const [noBuyReason, setNoBuyReason] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setNote("");
      setNoBuyReason(null);
    }
  }, [visible]);

  const message = cartItemCount > 0 ? labels.messageCart(cartItemCount) : labels.message;
  const canConfirm = noBuyReasonRequired ? noBuyReason != null : true;
  const modeLabel = noBuyReasonRequired ? labels.modeNoBuy : labels.modeVisitNote;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={props.onStay}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={styles.backdropTouch} onPress={props.onStay} />
        <SafeAreaView style={styles.sheetWrap} edges={["bottom"]}>
          <View style={styles.sheet}>
            <View style={styles.handle} />

            <View style={styles.hero}>
              <View style={styles.heroIcon}>
                <Ionicons name="exit-outline" size={28} color="#fff" />
              </View>
              <Text style={styles.title}>{labels.title}</Text>
              {modeLabel ? (
                <View style={[styles.modePill, noBuyReasonRequired && styles.modePillWarn]}>
                  <Text style={[styles.modePillText, noBuyReasonRequired && styles.modePillTextWarn]}>
                    {modeLabel}
                  </Text>
                </View>
              ) : null}
            </View>

            <ScrollView
              style={styles.scroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.message}>{message}</Text>

              {noBuyReasonRequired ? (
                <View style={styles.fieldBlock}>
                  <Text style={[styles.noteLabel, styles.noteLabelRequired]}>{labels.noteLabel}</Text>
                  {labels.pickReasonHint ? (
                    <Text style={styles.reasonHint}>{labels.pickReasonHint}</Text>
                  ) : null}
                  <View style={styles.reasonList}>
                    {NO_BUY_REASONS.map((reason) => {
                      const selected = noBuyReason === reason;
                      return (
                        <Pressable
                          key={reason}
                          style={[styles.reasonRow, selected && styles.reasonRowOn]}
                          onPress={() => setNoBuyReason(reason)}
                          disabled={busy}
                        >
                          <View style={[styles.radio, selected && styles.radioOn]}>
                            {selected ? <View style={styles.radioDot} /> : null}
                          </View>
                          <Text style={[styles.reasonText, selected && styles.reasonTextOn]}>{reason}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : (
                <View style={styles.fieldBlock}>
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
                </View>
              )}
            </ScrollView>

            <View style={styles.actions}>
              <Pressable
                style={[styles.confirmBtn, (busy || !canConfirm) && styles.btnDisabled]}
                onPress={() =>
                  props.onConfirm({
                    note: noBuyReasonRequired ? noBuyReason! : note.trim(),
                    kind: noBuyReasonRequired ? "no-buy-reason" : "visit-note",
                  })
                }
                disabled={busy || !canConfirm}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={22} color="#fff" />
                    <Text style={styles.confirmBtnText}>{labels.confirm}</Text>
                  </>
                )}
              </Pressable>

              {cartItemCount > 0 ? (
                <Pressable style={styles.secondaryBtn} onPress={props.onGoCart} disabled={busy}>
                  <Ionicons name="cart-outline" size={20} color={theme.accentDark} />
                  <Text style={styles.secondaryBtnText}>{labels.goCart}</Text>
                </Pressable>
              ) : null}

              <Pressable style={styles.stayBtn} onPress={props.onStay} disabled={busy}>
                <Text style={styles.stayBtnText}>{labels.stay}</Text>
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
    backgroundColor: "rgba(15, 23, 42, 0.55)",
  },
  backdropTouch: { ...StyleSheet.absoluteFillObject },
  sheetWrap: { width: "100%" },
  sheet: {
    backgroundColor: theme.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 12,
    maxHeight: "92%",
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
  hero: { alignItems: "center", marginBottom: 8 },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.danger,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  title: {
    color: theme.text,
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 10,
  },
  modePill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.accentSoft,
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.25)",
  },
  modePillWarn: {
    backgroundColor: "#fff1f2",
    borderColor: "#fecdd3",
  },
  modePillText: {
    color: theme.accentDark,
    fontSize: 13,
    fontWeight: "800",
  },
  modePillTextWarn: { color: "#be123c" },
  scroll: { maxHeight: 340 },
  message: {
    color: theme.muted,
    fontSize: 15,
    lineHeight: 24,
    textAlign: "right",
    marginBottom: 16,
  },
  fieldBlock: { marginBottom: 8 },
  noteLabel: {
    color: theme.muted,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "right",
    marginBottom: 8,
  },
  noteLabelRequired: { color: theme.danger },
  reasonHint: {
    color: theme.muted,
    fontSize: 13,
    textAlign: "right",
    marginBottom: 12,
    lineHeight: 20,
  },
  reasonList: { gap: 10 },
  reasonRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
    borderColor: theme.line,
    backgroundColor: "#f8fafc",
  },
  reasonRowOn: {
    borderColor: theme.accent,
    backgroundColor: theme.accentSoft,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.line,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { borderColor: theme.accent },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.accent,
  },
  reasonText: {
    flex: 1,
    color: theme.text,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "right",
    lineHeight: 22,
  },
  reasonTextOn: { color: theme.accentDark, fontWeight: "800" },
  noteInput: {
    minHeight: 100,
    maxHeight: 150,
    borderWidth: 1.5,
    borderColor: theme.line,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: theme.text,
    backgroundColor: "#f8fafc",
  },
  actions: { gap: 10, marginTop: 16, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.line },
  confirmBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.danger,
  },
  confirmBtnText: { color: "#fff", fontWeight: "800", fontSize: 17 },
  secondaryBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
    borderColor: theme.accent,
    backgroundColor: theme.accentSoft,
  },
  secondaryBtnText: { color: theme.accentDark, fontWeight: "800", fontSize: 16 },
  stayBtn: {
    paddingVertical: 12,
    alignItems: "center",
  },
  stayBtnText: { color: theme.muted, fontWeight: "700", fontSize: 15 },
  btnDisabled: { opacity: 0.55 },
});
