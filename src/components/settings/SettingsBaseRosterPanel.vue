<!-- FILE: src/components/settings/SettingsBaseRosterPanel.vue -->
<template>
  <section class="card">
    <SettingsBaseTabsHeader v-model="panelTab" :day-label="dayLabel" />

    <!-- ✅ 탭에 따라 해당 패널만 로드 -->
    <SettingsBaseRoutePanel v-if="panelTab === 'route'" :day-tab="dayTab" />

    <SettingsBaseRosterListPanel
      v-else
      :day-tab="dayTab"
      @select-person="onSelectPerson"
    />
  </section>
</template>

<script setup>
import { computed, ref } from "vue";

import SettingsBaseTabsHeader from "@/components/settings/SettingsBaseTabsHeader.vue";
import SettingsBaseRoutePanel from "@/components/settings/SettingsBaseRoutePanel.vue";
import SettingsBaseRosterListPanel from "@/components/settings/SettingsBaseRosterListPanel.vue";

const props = defineProps({
  weekDays: { type: Array, required: true },
  dayTab: { type: String, required: true }, // mon~fri
});

const emit = defineEmits([
  "update:dayTab",            // (유지)
  "update:selectedPersonId",  // ✅ 핵심
  "select-person",            // (선택) name까지 올리고 싶을 때
]);

/** ✅ 상단 패널 탭 상태 */
const panelTab = ref("route"); // 기본은 기본노선

/** ✅ 요일 라벨 */
const dayLabel = computed(() => {
  const map = { mon: "월요일", tue: "화요일", wed: "수요일", thu: "목요일", fri: "금요일" };
  return map[props.dayTab] || "";
});

/** ✅ 명단에서 이름 클릭 시 */
function onSelectPerson(payload) {
  const pid = payload?.personId || "";
  emit("update:selectedPersonId", pid);
  emit("select-person", payload);
}
</script>

<style scoped>
.card {
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  overflow: hidden;
}
</style>
