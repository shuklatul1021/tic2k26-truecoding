import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { AdminPageFrame } from "@/components/admin/AdminPageFrame";
import { adminApi, type WorkerAccount } from "@/lib/api";

function getWorkerStatus(worker: WorkerAccount) {
  if (!worker.workerVerified) {
    return {
      label: "Not verified",
      color: Colors.warning,
      backgroundColor: Colors.warningLight,
      icon: "clock",
    };
  }

  return {
    label: "Verified",
    color: Colors.success,
    backgroundColor: Colors.successLight,
    icon: "check-circle",
  };
}

export default function AdminWorkersScreen() {
  const qc = useQueryClient();
  const [workerName, setWorkerName] = useState("");
  const [workerEmail, setWorkerEmail] = useState("");
  const [workerPassword, setWorkerPassword] = useState("");

  const { data: workers, isLoading: workersLoading } = useQuery({
    queryKey: ["admin-workers"],
    queryFn: adminApi.getWorkers,
  });

  const createWorkerMutation = useMutation({
    mutationFn: () =>
      adminApi.createWorker({
        name: workerName.trim(),
        email: workerEmail.trim().toLowerCase(),
        password: workerPassword,
      }),
    onSuccess: () => {
      setWorkerName("");
      setWorkerEmail("");
      setWorkerPassword("");
      qc.invalidateQueries({ queryKey: ["admin-workers"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      Alert.alert(
        "Worker created",
        "Share the worker email and temporary password so they can sign in and complete their setup.",
      );
    },
    onError: (error: Error) => {
      Alert.alert("Could not create worker", error.message);
    },
  });

  const workerMetrics = useMemo(() => {
    const total = workers?.length ?? 0;
    const verified = workers?.filter((worker) => worker.workerVerified).length ?? 0;
    const ready = workers?.filter((worker) => worker.workerVerified && worker.onboardingCompleted).length ?? 0;

    return [
      { label: "Workers", value: total, icon: "users", color: Colors.primary },
      { label: "Verified", value: verified, icon: "shield", color: Colors.secondary },
      { label: "Ready", value: ready, icon: "check-circle", color: Colors.success },
    ];
  }, [workers]);

  function handleCreateWorker() {
    if (!workerName.trim() || !workerEmail.trim() || !workerPassword.trim()) {
      Alert.alert("Missing fields", "Enter name, email and temporary password.");
      return;
    }

    if (workerPassword.trim().length < 6) {
      Alert.alert("Weak password", "Temporary password must be at least 6 characters.");
      return;
    }

    createWorkerMutation.mutate();
  }

  return (
    <AdminPageFrame
      eyebrow="Admin workers"
      title="Create and manage worker accounts"
      subtitle="Provision worker access here, then track who has verified and completed onboarding."
    >
      <View style={styles.metricsRow}>
        {workerMetrics.map((metric) => (
          <View key={metric.label} style={styles.metricCard}>
            <View style={[styles.metricIconWrap, { backgroundColor: `${metric.color}18` }]}>
              <Feather name={metric.icon as never} size={18} color={metric.color} />
            </View>
            <Text style={styles.metricValue}>{metric.value}</Text>
            <Text style={styles.metricLabel}>{metric.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Create worker account</Text>
        <Text style={styles.panelSubtitle}>
          Workers are provisioned by admins only. They sign in with the credentials you create here and finish their own role and location setup.
        </Text>

        <View style={styles.formGrid}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Worker name"
              placeholderTextColor={Colors.placeholder}
              value={workerName}
              onChangeText={setWorkerName}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="worker@example.com"
              placeholderTextColor={Colors.placeholder}
              value={workerEmail}
              onChangeText={setWorkerEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Temporary password</Text>
            <TextInput
              style={styles.input}
              placeholder="At least 6 characters"
              placeholderTextColor={Colors.placeholder}
              value={workerPassword}
              onChangeText={setWorkerPassword}
              secureTextEntry
            />
          </View>
        </View>

        <Pressable
          style={[styles.primaryButton, createWorkerMutation.isPending && styles.buttonDisabled]}
          onPress={handleCreateWorker}
          disabled={createWorkerMutation.isPending}
        >
          {createWorkerMutation.isPending ? (
            <ActivityIndicator color={Colors.textInverse} />
          ) : (
            <>
              <Feather name="user-plus" size={18} color={Colors.textInverse} />
              <Text style={styles.primaryButtonText}>Create worker</Text>
            </>
          )}
        </Pressable>
      </View>

      <View style={styles.panel}>
        <View style={styles.panelHeaderRow}>
          <View>
            <Text style={styles.panelTitle}>Worker accounts</Text>
            <Text style={styles.panelSubtitle}>Review worker name, email, and verification status.</Text>
          </View>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{workers?.length ?? 0}</Text>
          </View>
        </View>

        {workersLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={Colors.secondary} />
          </View>
        ) : (workers?.length ?? 0) === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="users" size={34} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>No workers yet</Text>
            <Text style={styles.emptyText}>Create the first worker account to start assigning field operations.</Text>
          </View>
        ) : (
          <View style={styles.workerList}>
            {(workers ?? []).map((worker) => {
              const status = getWorkerStatus(worker);

              return (
                <View key={worker.id} style={styles.workerCard}>
                  <View style={styles.workerHeader}>
                    <View style={styles.workerIdentity}>
                      <Text style={styles.workerName}>{worker.name}</Text>
                      <Text style={styles.workerMeta}>{worker.email}</Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: status.backgroundColor }]}>
                      <Feather name={status.icon as never} size={13} color={status.color} />
                      <Text style={[styles.statusPillText, { color: status.color }]}>{status.label}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </AdminPageFrame>
  );
}

const styles = StyleSheet.create({
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metricCard: {
    flexGrow: 1,
    flexBasis: 100,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 11,
    gap: 5,
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 2,
  },
  metricIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  metricValue: {
    fontSize: 16,
    fontWeight: "800" as const,
    color: Colors.text,
  },
  metricLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "600" as const,
  },
  panel: {
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 13,
    gap: 10,
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 2,
  },
  panelHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  panelTitle: {
    fontSize: 17,
    fontWeight: "800" as const,
    color: Colors.text,
  },
  panelSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  formGrid: {
    gap: 12,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  input: {
    height: 42,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    paddingHorizontal: 14,
    color: Colors.text,
  },
  primaryButton: {
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.secondary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryButtonText: {
    color: Colors.textInverse,
    fontSize: 13,
    fontWeight: "800" as const,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  countBadge: {
    minWidth: 34,
    height: 34,
    borderRadius: 17,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primaryLight,
  },
  countBadgeText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: "800" as const,
  },
  loadingState: {
    paddingVertical: 28,
    alignItems: "center",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 28,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    color: Colors.textSecondary,
  },
  workerList: {
    gap: 12,
  },
  workerCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    padding: 12,
    gap: 10,
  },
  workerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  workerIdentity: {
    gap: 4,
    flex: 1,
  },
  workerName: {
    fontSize: 16,
    fontWeight: "800" as const,
    color: Colors.text,
  },
  workerMeta: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  statusPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: "800" as const,
  },
});
