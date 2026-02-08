<!-- FILE: src/components/settings/SettingsVehiclePanel.vue -->
<template>
  <section class="card">
    <div class="card-title">차량목록 ({{ headerDate }})</div>

    <div class="box">
      <!-- ✅ 한줄 탭: 전체/승차/하차 + 월~금 -->
      <div class="oneTabs" role="tablist" aria-label="보기/요일 선택">
        <!-- 필터 -->
        <button
          v-for="t in filterTabs"
          :key="t.key"
          class="tab pill"
          :class="{ on: viewTab === t.key }"
          type="button"
          @click="viewTab = t.key"
        >
          {{ t.label }}
        </button>

        <span class="sep" aria-hidden="true"></span>

        <!-- 요일(월~금만) -->
        <button
          v-for="d in weekDaysMonToFri"
          :key="d.key"
          class="tab"
          :class="{ on: dayTab === d.key }"
          type="button"
          @click="$emit('update:dayTab', d.key)"
        >
          {{ d.label }}
        </button>
      </div>

      <div class="minihelp" v-if="isLoading">데이터 로드 중…</div>
      <div class="minihelp" v-else-if="loadError">로드 오류: {{ loadError }}</div>

      <!-- 진행중 -->
      <div v-if="!isLoading && !loadError" class="stack2">
        <div class="group" v-if="showPickup">
          <div class="group-title pickup">승차</div>
          <div class="stack">
            <LineItem v-for="l in activePickup" :key="l.lineKey" :line="l" @toggle="store.toggleDone" />
            <Empty v-if="activePickup.length === 0" />
          </div>
        </div>

        <div class="group" v-if="showDropoff">
          <div class="group-title dropoff">하차</div>
          <div class="stack">
            <LineItem v-for="l in activeDropoff" :key="l.lineKey" :line="l" @toggle="store.toggleDone" />
            <Empty v-if="activeDropoff.length === 0" />
          </div>
        </div>
      </div>

      <!-- 완료 -->
      <h3 v-if="completedLines.length" class="sect done">완료됨</h3>

      <template v-if="completedLines.length">
        <div class="stack2">
          <div class="group" v-if="showPickup">
            <div class="group-title pickup">승차</div>
            <div class="stack">
              <LineItem v-for="l in completedPickup" :key="l.lineKey" :line="l" @toggle="store.toggleDone" />
              <Empty v-if="completedPickup.length === 0" />
            </div>
          </div>

          <div class="group" v-if="showDropoff">
            <div class="group-title dropoff">하차</div>
            <div class="stack">
              <LineItem v-for="l in completedDropoff" :key="l.lineKey" :line="l" @toggle="store.toggleDone" />
              <Empty v-if="completedDropoff.length === 0" />
            </div>
          </div>
        </div>
      </template>
    </div>
  </section>
</template>

<script setup>
import { computed, h, ref } from "vue";
import { useAppStore } from "@/store/jumpersStore";

const props = defineProps({
  weekDays: { type: Array, required: true },
  dayTab: { type: String, required: true },
});
defineEmits(["update:dayTab"]);

const store = useAppStore();

const isLoading = computed(() => !!(store.state.loadingPublic || store.state.loadingDone));
const loadError = computed(() => store.state.errorPublic || store.state.errorDone || "");

/** ✅ 헤더 날짜(homeOffsetDays 반영) */
const headerDate = computed(() => {
  const d0 = store?.homeDate?.value;
  const d = d0 instanceof Date ? d0 : new Date();
  const w = ["일", "월", "화", "수", "목", "금", "토"][d.getUTCDay()];
  return `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${w})`;
});

/** ✅ 상단 필터 탭(전체/승차/하차) */
const filterTabs = [
  { key: "all", label: "전체" },
  { key: "pickup", label: "승차" },
  { key: "dropoff", label: "하차" },
];
const viewTab = ref("all");

const showPickup = computed(() => viewTab.value === "all" || viewTab.value === "pickup");
const showDropoff = computed(() => viewTab.value === "all" || viewTab.value === "dropoff");

/** ✅ 요일: 월~금만 노출 */
const weekDaysMonToFri = computed(() => {
  const list = Array.isArray(props.weekDays) ? props.weekDays : [];
  const allowed = new Set(["월", "화", "수", "목", "금"]);

  const byLabel = list.filter((d) => allowed.has(String(d?.label || "").trim()));
  if (byLabel.length) return byLabel;

  const keyAllowed = new Set(["mon", "tue", "wed", "thu", "fri"]);
  return list.filter((d) => keyAllowed.has(String(d?.key || "").toLowerCase()));
});

/** ✅ 선택 요일 라인 (store 최신 구조: routes 기반 + 예약 우선 반영) */
const dayLines = computed(() => store.linesByDay(props.dayTab, store.todayYmd?.value));

/**
 * ✅ 핵심 수정:
 * - 이전엔 names가 0이면 라인을 버렸는데,
 *   "노선 변경이 즉시 보이게" 하려면 라인은 유지해야함.
 * - 그래서 allLines에서 names length 필터 제거
 */
const allLines = computed(() => {
  const d = dayLines.value || {};
  const pu = Array.isArray(d.pickup) ? d.pickup : [];
  const dof = Array.isArray(d.dropoff) ? d.dropoff : [];
  return [...pu, ...dof];
});

const activeLines = computed(() => allLines.value.filter((l) => !l.done));
const completedLines = computed(() => allLines.value.filter((l) => l.done));

const activePickup = computed(() => activeLines.value.filter((l) => l.type === "pickup"));
const activeDropoff = computed(() => activeLines.value.filter((l) => l.type === "dropoff"));
const completedPickup = computed(() => completedLines.value.filter((l) => l.type === "pickup"));
const completedDropoff = computed(() => completedLines.value.filter((l) => l.type === "dropoff"));

/** ✅ LineItem(차량목록 전용) */
const LineItem = {
  props: { line: { type: Object, required: true } },
  emits: ["toggle"],
  setup(props, { emit }) {
    return () => {
      const line = props.line || {};
      const done = !!line.done;
      const names = Array.isArray(line.names) ? line.names : [];

      return h("article", { class: ["line", done ? "is-done" : ""] }, [
        h("div", { class: "line-top" }, [
          h("div", { class: "time" }, String(line.time || "")),
          h("div", { class: "place" }, [h("span", { class: "place-text" }, String(line.place || ""))]),
          h(
            "button",
            {
              class: ["done-btn", done ? "cancel" : ""],
              type: "button",
              title: done ? "완료취소" : "완료",
              "aria-label": done ? "완료취소" : "완료",
              onClick: () => emit("toggle", line.lineKey),
            },
            done ? "취소" : "완료"
          ),
        ]),
        h("div", { class: "names-card" }, [
          names.length
            ? h(
                "div",
                { class: "names" },
                names.map((n) => h("span", { class: "name", key: String(n) }, String(n)))
              )
            : h("span", { class: "empty2" }, "—"),
        ]),
      ]);
    };
  },
};

const Empty = {
  setup() {
    return () => h("div", { class: "empty" }, "라인 없음");
  },
};
</script>

<style scoped>
.card {
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  overflow: hidden;
}
.card-title {
  padding: 12px 14px;
  font-weight: 1000;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.box {
  padding: 14px;
}

.minihelp {
  font-size: 12px;
  opacity: 0.7;
  line-height: 1.5;
  margin-top: 6px;
}

/* ✅ 한줄 탭(전체/승차/하차 + 월~금) */
.oneTabs {
  display: flex;
  align-items: center;
  gap: 6px;

  flex-wrap: nowrap;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 2px;

  margin-bottom: 12px;

  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.oneTabs::-webkit-scrollbar {
  display: none;
}

.tab {
  flex: 0 0 auto;
  font-size: 12px;
  padding: 7px 10px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.03);
  color: inherit;
  cursor: pointer;
  opacity: 0.9;
  white-space: nowrap;
}

.tab.pill.on {
  background: rgba(120, 170, 255, 0.12);
  border-color: rgba(120, 170, 255, 0.35);
  opacity: 1;
}

.tab.on:not(.pill) {
  background: rgba(0, 200, 120, 0.12);
  border-color: rgba(0, 200, 120, 0.35);
  color: #6cffc0;
  opacity: 1;
}

.sep {
  width: 1px;
  height: 18px;
  background: rgba(255, 255, 255, 0.14);
  margin: 0 4px;
  flex: 0 0 auto;
  border-radius: 1px;
}

.stack2 {
  display: grid;
  gap: 12px;
}
.stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.group {
  margin-top: 2px;
}
.group-title {
  width: 100%;
  display: block;
  box-sizing: border-box;
  text-align: left;
  padding: 10px 12px;
  border-radius: 14px;
  font-size: 12px;
  font-weight: 1000;
  letter-spacing: 0.6px;
  margin: 4px 0 10px;
}
.group-title.pickup {
  color: #6cffc0;
  border: 1px solid rgba(0, 200, 120, 0.35);
  background: rgba(0, 200, 120, 0.1);
  box-shadow: 0 0 14px rgba(0, 200, 120, 0.08);
}
.group-title.dropoff {
  color: #ffd7a6;
  border: 1px solid rgba(255, 159, 67, 0.45);
  background: rgba(255, 159, 67, 0.1);
  box-shadow: 0 0 14px rgba(255, 159, 67, 0.08);
}

.sect {
  margin: 14px 0 8px;
  font-weight: 900;
  opacity: 0.92;
  font-size: 13px;
}
.sect.done {
  margin-top: 18px;
}

/* ✅ LineItem */
:deep(.line) {
  display: grid;
  gap: 10px;
  padding: 10px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.14);
}
:deep(.line.is-done) {
  opacity: 0.6;
}
:deep(.line-top) {
  display: grid !important;
  grid-template-columns: 160px 1fr 52px !important;
  gap: 10px;
  align-items: center;
  min-width: 0;
  white-space: nowrap;
}
:deep(.time) {
  font-size: 18px;
  font-weight: 900;
  letter-spacing: 0.2px;
}
:deep(.place) {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
  overflow: hidden;
}
:deep(.place-text) {
  font-size: 13px;
  opacity: 0.9;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

:deep(.names-card) {
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  padding: 10px;
}
:deep(.names) {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
:deep(.name) {
  font-size: 12px;
  padding: 5px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  white-space: nowrap;
}
:deep(.empty2) {
  font-size: 12px;
  opacity: 0.55;
}

:deep(.done-btn) {
  width: 52px;
  height: 40px;
  display: grid;
  place-items: center;

  font-size: 16px;
  padding: 0;
  border-radius: 12px;
  border: 1px solid rgba(0, 200, 120, 0.35);
  background: rgba(0, 200, 120, 0.12);
  color: #6cffc0;
  cursor: pointer;
  font-weight: 900;
  line-height: 1;
}
:deep(.done-btn:hover) {
  background: rgba(0, 200, 120, 0.18);
}
:deep(.done-btn.cancel) {
  border-color: rgba(255, 159, 67, 0.45);
  background: rgba(255, 159, 67, 0.14);
  color: #ffd7a6;
  opacity: 1;
}

.empty {
  margin-top: 10px;
  padding: 12px;
  border-radius: 16px;
  border: 1px dashed rgba(255, 255, 255, 0.18);
  opacity: 0.75;
  text-align: center;
  background: rgba(0, 0, 0, 0.1);
}

@media (max-width: 720px) {
  :deep(.line-top) {
    grid-template-columns: 64px 1fr 44px !important;
    gap: 10px;
  }
  :deep(.done-btn) {
    width: 44px;
    height: 40px;
    font-size: 14px;
  }
}
</style>
