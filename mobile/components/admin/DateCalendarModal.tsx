import React, { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";

interface DateCalendarModalProps {
  visible: boolean;
  title: string;
  value?: string;
  onClose: () => void;
  onSelect: (value: string) => void;
  onClear?: () => void;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toDateValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function fromDateValue(value?: string) {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

export function DateCalendarModal({
  visible,
  title,
  value,
  onClose,
  onSelect,
  onClear,
}: DateCalendarModalProps) {
  const [monthCursor, setMonthCursor] = useState(() => fromDateValue(value) ?? new Date());

  const selectedValue = value ?? "";
  const monthLabel = monthCursor.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const calendarDays = useMemo(() => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const days: Array<{ key: string; label: string; value?: string; inMonth: boolean }> = [];

    for (let i = 0; i < firstDayOfMonth.getDay(); i += 1) {
      days.push({ key: `blank-${i}`, label: "", inMonth: false });
    }

    for (let day = 1; day <= lastDayOfMonth.getDate(); day += 1) {
      const current = new Date(year, month, day);
      days.push({
        key: toDateValue(current),
        label: String(day),
        value: toDateValue(current),
        inMonth: true,
      });
    }

    return days;
  }, [monthCursor]);

  function openPreviousMonth() {
    setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1));
  }

  function openNextMonth() {
    setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1));
  }

  function handleSelect(nextValue: string) {
    onSelect(nextValue);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Feather name="x" size={18} color={Colors.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.monthNav}>
            <Pressable style={styles.navBtn} onPress={openPreviousMonth}>
              <Feather name="chevron-left" size={18} color={Colors.text} />
            </Pressable>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
            <Pressable style={styles.navBtn} onPress={openNextMonth}>
              <Feather name="chevron-right" size={18} color={Colors.text} />
            </Pressable>
          </View>

          <View style={styles.weekdaysRow}>
            {WEEKDAY_LABELS.map((weekday) => (
              <Text key={weekday} style={styles.weekdayText}>
                {weekday}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {calendarDays.map((day) => {
              const isSelected = Boolean(day.value && day.value === selectedValue);

              return (
                <Pressable
                  key={day.key}
                  style={[styles.dayCell, isSelected && styles.dayCellSelected, !day.inMonth && styles.dayCellBlank]}
                  disabled={!day.value}
                  onPress={() => day.value && handleSelect(day.value)}
                >
                  <Text style={[styles.dayText, isSelected && styles.dayTextSelected]}>
                    {day.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.footer}>
            {onClear ? (
              <Pressable style={styles.secondaryBtn} onPress={onClear}>
                <Text style={styles.secondaryBtnText}>Clear</Text>
              </Pressable>
            ) : <View />}
            <Pressable style={styles.primaryBtn} onPress={onClose}>
              <Text style={styles.primaryBtnText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.38)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  sheet: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    padding: 18,
    gap: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "800" as const,
    color: Colors.text,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  navBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  monthLabel: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  weekdaysRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  weekdayText: {
    width: `${100 / 7}%`,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "700" as const,
    color: Colors.textSecondary,
    paddingBottom: 6,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  dayCell: {
    width: "13.6%",
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  dayCellSelected: {
    backgroundColor: Colors.primary,
  },
  dayCellBlank: {
    backgroundColor: "transparent",
  },
  dayText: {
    fontSize: 13,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  dayTextSelected: {
    color: Colors.textInverse,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  secondaryBtn: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Colors.background,
  },
  secondaryBtnText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: "700" as const,
  },
  primaryBtn: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.primary,
  },
  primaryBtnText: {
    color: Colors.textInverse,
    fontSize: 13,
    fontWeight: "700" as const,
  },
});
