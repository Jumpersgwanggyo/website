<!-- FILE: src/pages/Settings.vue -->
<template>
  <section class="layout">
    <header class="head">
      <div>
        <h2 class="h2">설정</h2>
      </div>
    </header>

    <div class="cols">
      <SettingsVehiclePanel v-model:dayTab="dayTab" :weekDays="weekDays" />

      <!-- ✅ 명단에서 선택된 사람 ID를 부모에서 받기 -->
      <SettingsBaseRosterPanel
        v-model:dayTab="dayTab"
        v-model:selectedPersonId="selectedPersonId"
        :weekDays="weekDays"
      />

      <!-- ✅ 선택된 사람만 표시되도록 전달 + 전체보기(선택해제) 처리 -->
      <SettingsRosterReservePanel
        :weekDays="weekDays"
        :selectedPersonId="selectedPersonId"
        @clear-selected="selectedPersonId = ''"
      />
    </div>
  </section>
</template>

<script setup>
import { ref } from "vue";
import { useAppStore } from "@/store/jumpersStore";

import SettingsVehiclePanel from "@/components/settings/SettingsVehiclePanel.vue";
import SettingsBaseRosterPanel from "@/components/settings/SettingsBaseRosterPanel.vue";
import SettingsRosterReservePanel from "@/components/settings/SettingsRosterReservePanel.vue";

const store = useAppStore();

const weekDays = [
  { key: "mon", label: "월" },
  { key: "tue", label: "화" },
  { key: "wed", label: "수" },
  { key: "thu", label: "목" },
  { key: "fri", label: "금" },
];

const dayTab = ref(weekDays[0].key);

/** ✅ 명단에서 클릭한 사람(필터링용) */
const selectedPersonId = ref("");
</script>

<style scoped>
/* Settings.vue는 "페이지 레이아웃"만 책임 */
.layout {
  display: grid;
  gap: 12px;
}

.head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

.h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 1000;
}
.hint {
  margin: 6px 0 0;
  opacity: 0.65;
  font-size: 12px;
}

.actions {
  display: flex;
  gap: 8px;
}
.btn {
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.04);
  color: inherit;
  font-weight: 1000;
  cursor: pointer;
}
.btn.danger {
  border-color: rgba(255, 120, 120, 0.3);
  background: rgba(255, 120, 120, 0.1);
}

.cols {
  display: grid;
  gap: 12px;
}

@media (min-width: 1100px) {
  .cols {
    grid-template-columns: 1fr 1fr 1fr;
    align-items: start;
  }
}
</style>
