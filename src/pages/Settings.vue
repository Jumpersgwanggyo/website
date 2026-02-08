<template>
  <section class="layout">
    <header class="head">
      <div>
        <h2 class="h2">설정(레이아웃 먼저)</h2>
        <p class="hint">DB 로드는 아직 안 함 · 더미 데이터로 “홈 동작”만 확인</p>
      </div>

      <div class="actions">
        <button class="btn" @click="store.scheduleSave?.()">로컬 저장</button>
        <button class="btn danger" @click="store.resetToDummy?.()">더미로 초기화</button>
      </div>
    </header>

    <div class="cols">
      <section class="card">
        <!-- ✅ 제목: homeOffsetDays 반영된 날짜 -->
        <div class="card-title">차량목록 ({{ headerDate }})</div>

        <div class="box">
          <div class="wtabs" role="tablist" aria-label="요일 선택">
            <button
              v-for="d in weekDays"
              :key="d.key"
              class="wtab"
              :class="{ on: dayTab === d.key }"
              type="button"
              @click="dayTab = d.key"
            >
              {{ d.label }}
            </button>
          </div>

          <div class="minihelp" v-if="store.state.loading">데이터 로드 중…</div>
          <div class="minihelp" v-else-if="store.state.error">로드 오류: {{ store.state.error }}</div>

          <div class="stack2">
            <div class="group">
              <div class="group-title pickup">승차</div>
              <div class="stack">
                <LineItem
                  v-for="l in dayPickup"
                  :key="l.lineKey"
                  :line="l"
                  @toggle="store.toggleDone"
                />
                <Empty v-if="dayPickup.length === 0" />
              </div>
            </div>

            <div class="group">
              <div class="group-title dropoff">하차</div>
              <div class="stack">
                <LineItem
                  v-for="l in dayDropoff"
                  :key="l.lineKey"
                  :line="l"
                  @toggle="store.toggleDone"
                />
                <Empty v-if="dayDropoff.length === 0" />
              </div>
            </div>
          </div>

          <p class="note">다음 단계: 여기에서 “기본노선 편집 UI” 붙일 거야.</p>
        </div>
      </section>

      <section class="card">
        <div class="card-title">명단(요약)</div>
        <div class="box">
          <div class="kv">
            <div class="k">사람 수</div>
            <div class="v">{{ peopleCount }}</div>
          </div>
          <div class="kv">
            <div class="k">원칙</div>
            <div class="v">예약이 있으면 기본 명단 무시</div>
          </div>

          <p class="note">다음 단계: “이름 기준으로 요일별 승/하차 장소 지정” UI.</p>
        </div>
      </section>

      <section class="card">
        <div class="card-title">예약(테스트)</div>
        <div class="box">
          <div class="kv">
            <div class="k">오늘 예약</div>
            <div class="v">{{ todayResCount }}</div>
          </div>

          <div class="minihelp">
            아래 폼으로 예약 추가하면, 홈에서 “예약 태그 + 명단 덮어쓰기”가 보여야 함.
          </div>

          <div class="sep"></div>

          <h3 class="h3">오늘 예약 추가</h3>
          <form class="form" @submit.prevent="submit">
            <div class="row2">
              <div class="row">
                <label>구분</label>
                <select v-model="f.type" class="inp">
                  <option value="pickup">승차</option>
                  <option value="dropoff">하차</option>
                </select>
              </div>
              <div class="row">
                <label>시간</label>
                <input v-model="f.time" class="inp" placeholder="14:05" />
              </div>
            </div>

            <div class="row">
              <label>장소</label>
              <input v-model="f.place" class="inp" placeholder="2부 더샵" />
            </div>

            <div class="row">
              <label>이름(쉼표)</label>
              <input v-model="f.names" class="inp" placeholder="(체험) 홍길동, 김철수" />
            </div>

            <div class="row2">
              <div class="row">
                <label>사유</label>
                <select v-model="f.reason" class="inp">
                  <option value="보강">보강</option>
                  <option value="체험">체험</option>
                  <option value="사용자지정">사용자지정</option>
                </select>
              </div>
              <div class="row" v-if="f.reason === '사용자지정'">
                <label>직접 입력</label>
                <input v-model="f.reasonCustom" class="inp" placeholder="사유 입력" />
              </div>
            </div>

            <button class="btn primary full" type="submit">추가</button>
          </form>
        </div>
      </section>
    </div>
  </section>
</template>

<script setup>
import { computed, reactive, ref, h, onMounted } from "vue";
import { useAppStore } from "@/store/jumpersStore";

const store = useAppStore();

onMounted(() => {
  store.subscribeApp();
  store.startClock?.();
});

const weekDays = [
  { key: "mon", label: "월" },
  { key: "tue", label: "화" },
  { key: "wed", label: "수" },
  { key: "thu", label: "목" },
  { key: "fri", label: "금" },
];

const dayTab = ref(weekDays[0].key);

const dayLines = computed(() => store.linesByDay(dayTab.value));
const dayPickup = computed(() => dayLines.value.pickup || []);
const dayDropoff = computed(() => dayLines.value.dropoff || []);

const peopleCount = computed(() => (store.state.data.people || []).length);
const todayResCount = computed(() =>
  (store.state.data.reservations || []).filter((r) => r.date === store.todayYmd?.value).length
);

const headerDate = computed(() => {
  const d0 = store?.homeDate?.value;
  const d = d0 instanceof Date ? d0 : new Date();
  const w = ["일", "월", "화", "수", "목", "금", "토"][d.getUTCDay()];
  return `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${w})`;
});

const f = reactive({
  type: "pickup",
  time: "",
  place: "",
  names: "",
  reason: "보강",
  reasonCustom: "",
});

function submit() {
  const time = (f.time || "").trim();
  const place = (f.place || "").trim();
  const rawNames = (f.names || "").trim();
  if (!time || !place || !rawNames) return;

  const names = rawNames.split(",").map((s) => s.trim()).filter(Boolean);
  const reason = f.reason === "사용자지정" ? (f.reasonCustom || "").trim() : f.reason;

  store.addReservation?.({
    date: store.todayYmd?.value,
    type: f.type,
    time,
    place,
    names,
    reason: reason || "사용자지정",
  });

  f.time = "";
  f.place = "";
  f.names = "";
  f.reasonCustom = "";
}

/* ✅ 홈과 동일: 완료/취소 토글 가능 */
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
/* (기존 스타일 유지) */
.layout{ display:grid; gap: 12px; }

.head{
  display:flex;
  align-items:flex-end;
  justify-content:space-between;
  gap: 12px;
}
.h2{ margin:0; font-size: 18px; font-weight: 1000; }
.h3{ margin: 0 0 10px; font-size: 14px; font-weight: 1000; }
.hint{ margin: 6px 0 0; opacity: 0.65; font-size: 12px; }

.actions{ display:flex; gap: 8px; }
.btn{
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.14);
  background: rgba(255,255,255,0.04);
  color: inherit;
  font-weight: 1000;
  cursor:pointer;
}
.btn.primary{ background: rgba(255,255,255,0.14); }
.btn.danger{ border-color: rgba(255,120,120,0.30); background: rgba(255,120,120,0.10); }

.cols{ display:grid; gap: 12px; }

.card{
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(255,255,255,0.04);
  overflow:hidden;
}
.card-title{
  padding: 12px 14px;
  font-weight: 1000;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.box{ padding: 14px; }

.kv{
  display:flex;
  justify-content:space-between;
  gap: 10px;
  padding: 10px 0;
  border-top: 1px solid rgba(255,255,255,0.06);
}
.kv:first-of-type{ border-top: 0; }
.kv .k{ opacity: 0.7; font-weight: 900; }
.kv .v{ font-weight: 1000; }

.note{ margin: 12px 0 0; font-size: 12px; opacity: 0.65; line-height: 1.5; }

.minihelp{
  font-size: 12px;
  opacity: 0.7;
  line-height: 1.5;
  margin-top: 6px;
}

.sep{
  height: 1px;
  background: rgba(255,255,255,0.08);
  margin: 14px 0;
}

.form{ display:grid; gap: 10px; margin-top: 10px; }
.row{ display:grid; gap: 6px; }
.row2{ display:grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.row label{ font-size: 12px; opacity: 0.7; font-weight: 900; }

.inp{
  width: 100%;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.14);
  background: rgba(255,255,255,0.04);
  color: inherit;
  outline: none;
}

.full{ width: 100%; }

@media (min-width: 1100px) {
  .cols{ grid-template-columns: 1fr 1fr 1fr; align-items: start; }
}

.wtabs{ display:flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
.wtab{
  font-size: 12px;
  padding: 7px 10px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.14);
  background: rgba(255,255,255,0.03);
  color: inherit;
  cursor: pointer;
  opacity: 0.9;
}
.wtab.on{
  background: rgba(0,200,120,0.12);
  border-color: rgba(0,200,120,0.35);
  color: #6cffc0;
  opacity: 1;
}

.stack2{ display:grid; gap: 12px; }
.stack{ display:flex; flex-direction:column; gap: 10px; }

.group{ margin-top: 2px; }
.group-title{
  width: 100%;
  display:block;
  box-sizing:border-box;
  text-align:left;
  padding: 10px 12px;
  border-radius: 14px;
  font-size: 12px;
  font-weight: 1000;
  letter-spacing: 0.6px;
  margin: 4px 0 10px;
}
.group-title.pickup{
  color: #6cffc0;
  border: 1px solid rgba(0,200,120,0.35);
  background: rgba(0,200,120,0.10);
  box-shadow: 0 0 14px rgba(0,200,120,0.08);
}
.group-title.dropoff{
  color: #ffd7a6;
  border: 1px solid rgba(255,159,67,0.45);
  background: rgba(255,159,67,0.10);
  box-shadow: 0 0 14px rgba(255,159,67,0.08);
}

/* ✅ 핵심: :deep로 한줄 레이아웃 강제 */
:deep(.line){
  display:grid;
  gap: 10px;
  padding: 10px;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(0,0,0,0.14);
}
:deep(.line.is-done){ opacity: 0.6; }

:deep(.line-top){
  display: grid !important;
  grid-template-columns: 160px 1fr 52px !important;
  gap: 10px;
  align-items: center;
  min-width: 0;
  white-space: nowrap;
}

:deep(.time){
  font-size: 18px;
  font-weight: 900;
  letter-spacing: 0.2px;
}

:deep(.place){
  display:flex;
  gap: 8px;
  align-items:center;
  min-width: 0;
  overflow:hidden;
}
:deep(.place-text){
  font-size: 13px;
  opacity: 0.9;
  font-weight: 700;
  overflow:hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

:deep(.badge){
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid rgba(255,196,92,0.25);
  background: rgba(255,196,92,0.16);
  font-weight: 900;
  white-space: nowrap;
}

:deep(.names-card){
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.03);
  padding: 10px;
}
:deep(.names){ display:flex; gap: 6px; flex-wrap: wrap; }
:deep(.name){
  font-size: 12px;
  padding: 5px 8px;
  border-radius: 999px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.08);
  white-space: nowrap;
}
:deep(.empty2){ font-size: 12px; opacity: 0.55; }

/* ✅ Home과 동일: 완료/취소 스타일 */
:deep(.done-btn){
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
:deep(.done-btn:hover){
  background: rgba(0, 200, 120, 0.18);
}
:deep(.done-btn.cancel){
  border-color: rgba(255, 159, 67, 0.45);
  background: rgba(255, 159, 67, 0.14);
  color: #ffd7a6;
  opacity: 1;
}

.empty{
  margin-top: 10px;
  padding: 12px;
  border-radius: 16px;
  border: 1px dashed rgba(255,255,255,0.18);
  opacity: 0.75;
  text-align: center;
  background: rgba(0,0,0,0.10);
}

@media (max-width: 720px) {
  :deep(.line-top){
    grid-template-columns: 64px 1fr 44px !important;
    gap: 10px;
  }
  :deep(.done-btn){
    width: 44px;
    height: 40px;
    font-size: 14px;
  }
}
</style>
