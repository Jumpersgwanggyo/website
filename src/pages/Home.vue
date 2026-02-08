<!-- FILE: src/pages/Home.vue -->
<template>
  <section class="page">
    <section class="card">
      <header class="card-head">
        <!-- ✅ 왼쪽: 타이틀 + 날짜 -->
        <div class="head-left">
          <h2 class="h2">오늘의 차량 일정</h2>
          <p class="hint">{{ headerDate }}</p>
        </div>

        <!-- ✅ 오른쪽: 큰 네온 시계 -->
        <div class="head-right" aria-label="한국 표준시">
          <span class="neon-kst">KST</span>
          <span class="neon-clock">{{ kstClockHM }}</span>
        </div>
      </header>

      <!-- 탭 -->
      <div class="tabs">
        <button class="tab" :class="{ on: tab === 'all' }" @click="tab = 'all'">전체</button>
        <button class="tab" :class="{ on: tab === 'pickup' }" @click="tab = 'pickup'">승차</button>
        <button class="tab" :class="{ on: tab === 'dropoff' }" @click="tab = 'dropoff'">하차</button>
      </div>

      <div class="content">
        <template v-if="tab === 'all'">
          <!-- ✅ 전체 탭: 승차/하차 -->
          <div class="group">
            <div class="group-title pickup">승차</div>
            <div class="stack">
              <LineItem v-for="l in activePickup" :key="l.lineKey" :line="l" @toggle="store.toggleDone" />
              <Empty v-if="activePickup.length === 0" />
            </div>
          </div>

          <div class="group">
            <div class="group-title dropoff">하차</div>
            <div class="stack">
              <LineItem v-for="l in activeDropoff" :key="l.lineKey" :line="l" @toggle="store.toggleDone" />
              <Empty v-if="activeDropoff.length === 0" />
            </div>
          </div>
        </template>

        <template v-else-if="tab === 'pickup'">
          <div class="stack">
            <LineItem v-for="l in activePickup" :key="l.lineKey" :line="l" @toggle="store.toggleDone" />
            <Empty v-if="activePickup.length === 0" />
          </div>
        </template>

        <template v-else>
          <div class="stack">
            <LineItem v-for="l in activeDropoff" :key="l.lineKey" :line="l" @toggle="store.toggleDone" />
            <Empty v-if="activeDropoff.length === 0" />
          </div>
        </template>

        <!-- ✅ 완료 (승차/하차로 분리) -->
        <h3
          v-if="completedLines.length"
          class="sect done"
        >
          완료됨
        </h3>

        <template v-if="completedLines.length">
          <template v-if="tab === 'all'">
            <div class="group">
              <div class="group-title pickup">승차</div>
              <div class="stack">
                <LineItem v-for="l in completedPickup" :key="l.lineKey" :line="l" @toggle="store.toggleDone" />
                <Empty v-if="completedPickup.length === 0" />
              </div>
            </div>

            <div class="group">
              <div class="group-title dropoff">하차</div>
              <div class="stack">
                <LineItem v-for="l in completedDropoff" :key="l.lineKey" :line="l" @toggle="store.toggleDone" />
                <Empty v-if="completedDropoff.length === 0" />
              </div>
            </div>
          </template>

          <template v-else-if="tab === 'pickup'">
            <div class="stack">
              <LineItem v-for="l in completedPickup" :key="l.lineKey" :line="l" @toggle="store.toggleDone" />
              <Empty v-if="completedPickup.length === 0" />
            </div>
          </template>

          <template v-else>
            <div class="stack">
              <LineItem v-for="l in completedDropoff" :key="l.lineKey" :line="l" @toggle="store.toggleDone" />
              <Empty v-if="completedDropoff.length === 0" />
            </div>
          </template>
        </template>
      </div>
    </section>
  </section>
</template>

<script setup>
import { computed, ref, h } from "vue";
import { useAppStore } from "@/store/jumpersStore";

const store = useAppStore();
const tab = ref("all");

const kstNowSafe = computed(() => {
  const d = store?.kstNow?.value;
  return d instanceof Date ? d : new Date();
});

const kstClockHM = computed(() => {
  const d = kstNowSafe.value;
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
});

const headerDate = computed(() => {
  const d = kstNowSafe.value;
  const w = ["일", "월", "화", "수", "목", "금", "토"][d.getUTCDay()];
  return `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${w})`;
});

const allLines = computed(() => {
  const data = store?.todayLines?.value;
  if (!data || typeof data !== "object") return [];
  const pu = Array.isArray(data.pickup) ? data.pickup : [];
  const dof = Array.isArray(data.dropoff) ? data.dropoff : [];
  return [...pu, ...dof].filter((l) => Array.isArray(l?.names) && l.names.length > 0);
});

const activeLines = computed(() => allLines.value.filter((l) => !l.done));
const completedLines = computed(() => allLines.value.filter((l) => l.done));

const activePickup = computed(() => activeLines.value.filter((l) => l.type === "pickup"));
const activeDropoff = computed(() => activeLines.value.filter((l) => l.type === "dropoff"));

/* ✅ 완료도 승차/하차로 분리 */
const completedPickup = computed(() => completedLines.value.filter((l) => l.type === "pickup"));
const completedDropoff = computed(() => completedLines.value.filter((l) => l.type === "dropoff"));

const LineItem = {
  props: { line: { type: Object, required: true } },
  emits: ["toggle"],
  setup(props, { emit }) {
    return () => {
      const line = props.line || {};
      const done = !!line.done;
      const names = Array.isArray(line.names) ? line.names : [];

      return h("article", { class: ["line", done ? "is-done" : ""] }, [
        // ✅ 시간 + 장소 + 완료 : 한 줄
        h("div", { class: "line-top" }, [
          h("div", { class: "time" }, String(line.time || "")),
          h("div", { class: "place" }, [
            h("span", { class: "place-text" }, String(line.place || "")),
            line.hasReservation ? h("span", { class: "badge" }, "예약") : null,
          ]),
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

        // ✅ 명단
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
/* ✅ header: 왼쪽(타이틀+날짜) / 오른쪽(큰 네온 시계) */
.card-head {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 12px;
}

.head-left {
  min-width: 0;
}

.head-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  padding-left: 10px;
  min-width: 132px;
}

.neon-kst {
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 2px;
  opacity: 0.75;
  color: #6cffc0;
  text-shadow: 0 0 8px rgba(108, 255, 192, 0.35);
}

.neon-clock {
  font-size: 26px;
  font-weight: 900;
  letter-spacing: 2px;
  font-variant-numeric: tabular-nums;

  color: #6cffc0;
  text-shadow: 0 0 6px rgba(108, 255, 192, 0.65), 0 0 16px rgba(108, 255, 192, 0.25);

  padding: 6px 10px 7px;
  border-radius: 14px;
  border: 1px solid rgba(0, 200, 120, 0.28);
  background: rgba(0, 200, 120, 0.1);
  box-shadow: 0 0 0 1px rgba(0, 200, 120, 0.06) inset, 0 0 18px rgba(0, 200, 120, 0.12);
}

/* content/stack */
.content {
  padding: 16px;
}
.stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* ✅ 전체 탭: 승차/하차 제목 */
.group {
  margin-top: 12px;
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

/* section title (완료만 사용) */
.sect {
  margin: 10px 0 6px;
  font-weight: 900;
  opacity: 0.92;
  font-size: 13px;
}
.sect.done {
  margin-top: 18px;
}

/* tabs */
.tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  padding: 10px 16px 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.tab {
  font-size: 12px;
  padding: 7px 10px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.03);
  color: inherit;
  cursor: pointer;
  opacity: 0.9;
}
.tab.on {
  background: rgba(0, 200, 120, 0.12);
  border-color: rgba(0, 200, 120, 0.35);
  color: #6cffc0;
  opacity: 1;
}

/* ✅ 중요: LineItem 내부는 "자식 컴포넌트"라 scoped가 안 먹어서 :deep()로 적용 */
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

/* ✅ 시간/장소/완료를 "무조건 한 줄" */
:deep(.line-top) {
  display: grid;
  grid-template-columns: 160px 1fr 52px;
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

:deep(.badge) {
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid rgba(255, 196, 92, 0.25);
  background: rgba(255, 196, 92, 0.16);
  font-weight: 900;
  white-space: nowrap;
}

/* ✅ 명단 카드 */
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

/* ✅ 완료 버튼 */
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

/* empty */
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
  .neon-clock {
    font-size: 22px;
    padding: 6px 9px 7px;
  }

  :deep(.line-top) {
    grid-template-columns: 64px 1fr 44px;
    gap: 10px;
    white-space: nowrap;
  }

  :deep(.time) {
    min-width: 64px;
  }

  :deep(.done-btn) {
    width: 44px;
    height: 40px;
  }
}
</style>
