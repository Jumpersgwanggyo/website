<!-- FILE: src/components/settings/SettingsRosterTrialPanel.vue -->
<template>
  <section class="card">
    <SettingsRosterReserveTabsHeader v-model="tab" :dayLabel="dayLabel" />

    <div class="box">
      <div class="minihelp" v-if="isLoading">데이터 로드 중…</div>
      <div class="minihelp" v-else-if="loadError">로드 오류: {{ loadError }}</div>

      <template v-else>
        <div class="subhead">체험/일회용 예약</div>
        <div class="minihelp">
          여기 영역은 “명단(personId)” 없이도 저장되는 체험 예약만 다뤄.
          (연동은 store 액션에 붙이면 돼)
        </div>

        <!-- ✅ 입력 UI (연동은 나중에) -->
        <div class="trialbox">
          <div class="row">
            <div class="lab">이름</div>
            <input class="inp" v-model="form.tempName" type="text" placeholder="예: 홍길동(체험)" />
          </div>

          <div class="row">
            <div class="lab">승/하차</div>
            <select class="inp" v-model="form.type">
              <option value="pickup">승차</option>
              <option value="dropoff">하차</option>
            </select>
          </div>

          <div class="row">
            <div class="lab">시간</div>
            <input class="inp" v-model="form.time" type="text" placeholder="예: 14:10" />
          </div>

          <div class="row">
            <div class="lab">장소</div>
            <input class="inp" v-model="form.place" type="text" placeholder="예: 더샵 정문" />
          </div>

          <div class="row">
            <div class="lab">사유</div>
            <input class="inp" v-model="form.kind" type="text" placeholder="예: 체험" />
          </div>

          <div class="actions">
            <button class="btn" type="button" @click="onAddTemp">
              체험 예약 추가(연동 예정)
            </button>
            <button class="ghost" type="button" @click="onReset">초기화</button>
          </div>

          <div class="minihelp dim">
            ※ 저장/삭제는 Firestore 스키마 확정되면 store action으로 연결하면 끝.
          </div>
        </div>

        <div class="sep"></div>

        <!-- ✅ 오늘 체험 예약 리스트 -->
        <div class="subhead">오늘 체험 예약 목록</div>
        <div class="minihelp">선택 날짜({{ activeYmd }})의 임시 예약만 보여줘.</div>

        <div class="resbox">
          <div class="kv">
            <div class="k">총 체험 예약 수</div>
            <div class="v">{{ tempReservations.length }}</div>
          </div>

          <div v-if="tempReservations.length" class="reslist">
            <div v-for="(r, idx) in tempReservations" :key="'tmp-' + idx" class="rescard">
              <div class="reshead">
                <div class="resname">{{ r.tempName || "체험" }}</div>
                <div class="respid">임시</div>
              </div>
              <div class="resitems">
                <div class="resitem">
                  <span class="r-badge">{{ r.kind || r.reason || "체험" }}</span>
                  <span class="r-text">
                    <b>{{ r.type === "dropoff" ? "하차" : "승차" }}</b>
                    · {{ r.time || "—" }} · {{ r.place || "—" }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="emptymini">해당 날짜에 체험/임시 예약이 없어.</div>
        </div>
      </template>
    </div>
  </section>
</template>

<script setup>
import { computed, reactive, ref } from "vue";
import { useAppStore } from "@/store/jumpersStore";
import SettingsRosterReserveTabsHeader from "@/components/settings/SettingsRosterReserveTabsHeader.vue";

const props = defineProps({
  /** 탭 상태를 부모에서 들고 싶으면 v-model로 바꿔도 됨 */
  initialTab: { type: String, default: "trial" }, // 'roster' | 'trial'
});

const store = useAppStore();

const tab = ref(props.initialTab);

const isLoading = computed(() => !!(store.state.loadingPublic || store.state.loadingDone));
const loadError = computed(() => store.state.errorPublic || store.state.errorDone || "");

const activeYmd = computed(() => store.todayYmd?.value || "");
const dayLabel = computed(() => (activeYmd.value ? activeYmd.value : ""));

function safeStr(v) {
  return typeof v === "string" ? v : "";
}

/** reservations */
const reservations = computed(() =>
  Array.isArray(store.state.public.reservations) ? store.state.public.reservations : []
);

const reservationsForDay = computed(() => {
  const ymd = activeYmd.value;
  if (!ymd) return [];
  return reservations.value.filter((r) => safeStr(r?.date) === ymd);
});

/** ✅ 임시(체험) 예약만 */
const tempReservations = computed(() => {
  const out = [];
  for (const r of reservationsForDay.value) {
    const pid = safeStr(r?.personId).trim();
    if (pid) continue;

    const tempName = safeStr(r?.tempName).trim();
    const kind = safeStr(r?.kind) || safeStr(r?.reason) || "체험";
    const type = safeStr(r?.type) || "pickup";
    const time = safeStr(r?.time) || "—";
    const place = safeStr(r?.place) || "—";

    out.push({ tempName, kind, type, time, place });
  }
  return out;
});

/** ✅ UI 입력폼 */
const form = reactive({
  tempName: "",
  type: "pickup",
  time: "",
  place: "",
  kind: "체험",
});

function onReset() {
  form.tempName = "";
  form.type = "pickup";
  form.time = "";
  form.place = "";
  form.kind = "체험";
}

function onAddTemp() {
  // TODO: store 액션 연결
  console.log("[trial] add temp reservation (pending)", { date: activeYmd.value, ...form });
}
</script>

<style scoped>
.card {
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  overflow: hidden;
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
.minihelp.dim {
  opacity: 0.6;
}

.subhead {
  font-size: 12px;
  font-weight: 1000;
  letter-spacing: 0.4px;
  opacity: 0.9;
  margin: 2px 0 10px;
}

.sep {
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
  margin: 14px 0;
}

.emptymini {
  font-size: 12px;
  opacity: 0.55;
  padding: 10px 0 0;
}

/* 입력 */
.trialbox {
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.12);
  padding: 12px;
  display: grid;
  gap: 10px;
}
.row {
  display: grid;
  grid-template-columns: 70px 1fr;
  gap: 10px;
  align-items: center;
}
.lab {
  font-size: 12px;
  font-weight: 1000;
  opacity: 0.8;
}
.inp {
  height: 38px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.12);
  color: inherit;
  padding: 0 12px;
  outline: none;
}
.inp::placeholder {
  opacity: 0.5;
}
.actions {
  display: flex;
  gap: 8px;
  margin-top: 2px;
}
.btn,
.ghost {
  height: 38px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
  color: inherit;
  font-weight: 1000;
  cursor: pointer;
  padding: 0 12px;
  white-space: nowrap;
}
.btn {
  flex: 1;
}
.btn:active,
.ghost:active {
  transform: translateY(1px);
}

/* 리스트 */
.resbox {
  display: grid;
  gap: 10px;
}
.kv {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}
.kv:first-of-type {
  border-top: 0;
}
.kv .k {
  opacity: 0.7;
  font-weight: 900;
}
.kv .v {
  font-weight: 1000;
}
.reslist {
  display: grid;
  gap: 10px;
}
.rescard {
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.12);
  padding: 10px;
}
.reshead {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: flex-end;
  margin-bottom: 8px;
}
.resname {
  font-weight: 1000;
}
.respid {
  font-size: 11px;
  opacity: 0.6;
}
.resitems {
  display: grid;
  gap: 6px;
}
.resitem {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
}
.r-badge {
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid rgba(255, 196, 92, 0.22);
  background: rgba(255, 196, 92, 0.14);
  white-space: nowrap;
  font-weight: 900;
}
.r-text {
  font-size: 12px;
  opacity: 0.9;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
