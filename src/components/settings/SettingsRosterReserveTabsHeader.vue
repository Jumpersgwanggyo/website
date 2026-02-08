<!-- FILE: src/components/settings/SettingsRosterReserveTabsHeader.vue -->
<template>
  <div class="card-title">
    <div class="title-left">
      <button
        type="button"
        class="title-tab"
        :class="{ on: modelValue === 'roster' }"
        @click="emit('update:modelValue', 'roster')"
      >
        명단
      </button>

      <button
        type="button"
        class="title-tab"
        :class="{ on: modelValue === 'trial' }"
        @click="emit('update:modelValue', 'trial')"
      >
        체험
      </button>
    </div>

    <div class="title-right">{{ dayLabel }}</div>
  </div>
</template>

<script setup>
const props = defineProps({
  modelValue: { type: String, required: true }, // 'roster' | 'trial'
  dayLabel: { type: String, default: "" }, // 예: (2026-02-08) 같은 표시
});
const emit = defineEmits(["update:modelValue"]);
</script>

<style scoped>
.card-title {
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.title-left {
  display: flex;
  gap: 8px;
  align-items: center;
}
.title-tab {
  appearance: none;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.03);
  color: rgba(255, 255, 255, 0.8);
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 1000;
  cursor: pointer;
}
.title-tab.on {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.18);
  color: rgba(255, 255, 255, 0.95);
}
.title-right {
  font-size: 12px;
  font-weight: 1000;
  opacity: 0.8;
  white-space: nowrap;
}
</style>
