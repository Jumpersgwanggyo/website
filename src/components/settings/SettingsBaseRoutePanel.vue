<!-- FILE: src/components/settings/SettingsBaseRoutePanel.vue -->
<template>
  <div class="box">
    <div class="minihelp" v-if="isLoading">데이터 로드 중…</div>
    <div class="minihelp" v-else-if="loadError">로드 오류: {{ loadError }}</div>

    <template v-else>
      <!-- ✅ 요일 탭 헤더 -->
      <div class="head">
        <div class="subhead">기본노선</div>

        <div class="tabs" role="tablist" aria-label="요일 탭">
          <button
            v-for="d in days"
            :key="d.key"
            class="tab"
            :class="{ on: selectedDay === d.key }"
            type="button"
            role="tab"
            :aria-selected="selectedDay === d.key"
            @click="selectedDay = d.key"
          >
            {{ d.label }}
          </button>
        </div>
      </div>

      <!-- ✅ 빠른 추가: 요일 선택 바로 아래 -->
      <div class="quickAdd">
        <select class="sel" v-model="qaKind" @focus="onFocus()" @blur="onBlurCommit()">
          <option value="pickup">승차</option>
          <option value="dropoff">하차</option>
        </select>

        <input
          class="inp time"
          v-model="qaTime"
          placeholder="시간 (예: 14:05)"
          inputmode="numeric"
          @focus="onFocus()"
          @blur="onBlurCommit()"
        />

        <input
          class="inp place"
          v-model="qaPlace"
          placeholder="장소"
          @focus="onFocus()"
          @blur="onBlurCommit()"
        />

        <button class="addBtn" type="button" @click="quickAddStop()">추가</button>
      </div>

      <section class="daypanel">
        <div class="subgroup">
          <div class="subtag pickup">승차</div>

          <div class="list">
            <div
              v-for="(s, idx) in draftPickup"
              :key="s.id || ('pu-' + selectedDay + '-' + idx)"
              class="rowitem"
            >
              <input
                class="inp time"
                :value="s.time"
                placeholder="시간"
                inputmode="numeric"
                @focus="onFocus()"
                @input="onDraftEdit('pickup', idx, 'time', $event.target.value)"
                @blur="onBlurCommit()"
              />

              <input
                class="inp place"
                :value="s.place"
                placeholder="장소"
                @focus="onFocus()"
                @input="onDraftEdit('pickup', idx, 'place', $event.target.value)"
                @blur="onBlurCommit()"
              />

              <button class="del" type="button" @click="removeStop('pickup', idx)">삭제</button>
            </div>

            <div v-if="draftPickup.length === 0" class="emptymini">승차 라인 없음</div>

            <button class="add" type="button" @click="addStop('pickup')">+ 승차 라인 추가</button>
          </div>
        </div>

        <div class="subgroup">
          <div class="subtag dropoff">하차</div>

          <div class="list">
            <div
              v-for="(s, idx) in draftDropoff"
              :key="s.id || ('do-' + selectedDay + '-' + idx)"
              class="rowitem"
            >
              <input
                class="inp time"
                :value="s.time"
                placeholder="시간"
                inputmode="numeric"
                @focus="onFocus()"
                @input="onDraftEdit('dropoff', idx, 'time', $event.target.value)"
                @blur="onBlurCommit()"
              />

              <input
                class="inp place"
                :value="s.place"
                placeholder="장소"
                @focus="onFocus()"
                @input="onDraftEdit('dropoff', idx, 'place', $event.target.value)"
                @blur="onBlurCommit()"
              />

              <button class="del" type="button" @click="removeStop('dropoff', idx)">삭제</button>
            </div>

            <div v-if="draftDropoff.length === 0" class="emptymini">하차 라인 없음</div>

            <button class="add" type="button" @click="addStop('dropoff')">+ 하차 라인 추가</button>
          </div>
        </div>

        <p class="note">
          입력 중에는 저장하지 않고, 입력을 끝낸 뒤(포커스 해제) 변경된 내용만 저장됩니다.
          (저장은 store 자동저장 → Firestore 반영)
        </p>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { useAppStore } from "@/store/jumpersStore";

const store = useAppStore();

/** ✅ 로딩/에러 */
const isLoading = computed(() => !!(store.state.loadingPublic || store.state.loadingDone));
const loadError = computed(() => store.state.errorPublic || store.state.errorDone || "");

/** ✅ 요일 */
const days = [
  { key: "mon", label: "월" },
  { key: "tue", label: "화" },
  { key: "wed", label: "수" },
  { key: "thu", label: "목" },
  { key: "fri", label: "금" },
];

const selectedDay = ref("mon");

/** ✅ 빠른 추가 상태 */
const qaKind = ref("pickup"); // pickup | dropoff
const qaTime = ref("");
const qaPlace = ref("");

/** ✅ 원본 routes */
const routes = computed(() => store.state.public.routes || {});
const srcDayObj = computed(() => routes.value?.[selectedDay.value] || { pickup: [], dropoff: [] });

function normalizeStops(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((s) => ({
    id: (s?.id ?? "").toString(),
    time: (s?.time ?? "").toString(),
    place: (s?.place ?? "").toString(),
  }));
}
function deepCloneStops(arr) {
  return arr.map((s) => ({ ...s }));
}

/** ✅ 시간 정렬 유틸 */
function toSortTime(t) {
  const s = String(t || "").trim();
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return "99:99";
  const hh = String(Math.min(99, Math.max(0, parseInt(m[1], 10) || 0))).padStart(2, "0");
  const mm = String(Math.min(59, Math.max(0, parseInt(m[2], 10) || 0))).padStart(2, "0");
  return `${hh}:${mm}`;
}
function sortStopsByTime(stops) {
  return [...stops].sort((a, b) => {
    const at = toSortTime(a?.time);
    const bt = toSortTime(b?.time);
    const c = at.localeCompare(bt);
    if (c !== 0) return c;
    const ap = String(a?.place || "");
    const bp = String(b?.place || "");
    return ap.localeCompare(bp);
  });
}

/** ✅ 드래프트 + 스냅샷 */
const draftPickup = ref([]);
const draftDropoff = ref([]);
const snapPickup = ref([]);
const snapDropoff = ref([]);

/** ✅ 입력 중 저장 방지 */
const isEditing = ref(false);
let blurCommitTimer = null;

function onFocus() {
  isEditing.value = true;
  if (blurCommitTimer) {
    clearTimeout(blurCommitTimer);
    blurCommitTimer = null;
  }
}
function onBlurCommit() {
  if (blurCommitTimer) clearTimeout(blurCommitTimer);
  blurCommitTimer = setTimeout(() => {
    blurCommitTimer = null;
    isEditing.value = false;
    commitIfChanged();
  }, 150);
}

function refreshDraftFromStore() {
  const pu = normalizeStops(srcDayObj.value.pickup);
  const dof = normalizeStops(srcDayObj.value.dropoff);

  draftPickup.value = deepCloneStops(pu);
  draftDropoff.value = deepCloneStops(dof);
  snapPickup.value = deepCloneStops(pu);
  snapDropoff.value = deepCloneStops(dof);
}

watch(
  () => selectedDay.value,
  () => {
    if (isEditing.value) {
      isEditing.value = false;
      commitIfChanged();
    }
    refreshDraftFromStore();
  },
  { immediate: true }
);

watch(
  () => store.state.public.routes,
  () => {
    if (isEditing.value) return;
    refreshDraftFromStore();
  }
);

function onDraftEdit(kind, idx, field, val) {
  const arr = kind === "pickup" ? draftPickup.value : draftDropoff.value;
  if (!arr[idx]) arr[idx] = { id: "", time: "", place: "" };
  arr[idx] = { ...arr[idx], [field]: val };
}

function genStopId(kind, dayKey) {
  const r = Math.random().toString(16).slice(2, 8);
  const t = Date.now().toString(36);
  return `${dayKey}-${kind}-${t}-${r}`;
}

/** ✅ “추가 버튼”은 즉시 저장 구조 */
function quickAddStop() {
  const kind = qaKind.value;
  const dayKey = selectedDay.value;

  const time = String(qaTime.value || "").trim();
  const place = String(qaPlace.value || "").trim();

  // 최소 검증: 장소는 필수(시간은 빈값도 허용하고 싶으면 여기서만 풀면 됨)
  if (!place) return;

  const item = {
    id: genStopId(kind, dayKey),
    time,
    place,
  };

  // 입력 중 상태 종료 + blur 타이머 제거
  if (blurCommitTimer) {
    clearTimeout(blurCommitTimer);
    blurCommitTimer = null;
  }
  isEditing.value = false;

  if (kind === "pickup") draftPickup.value.push(item);
  else draftDropoff.value.push(item);

  // store 반영(= autosave로 Firestore 저장)
  commitIfChanged();

  // 입력칸 초기화
  qaTime.value = "";
  qaPlace.value = "";
}

function addStop(kind) {
  const dayKey = selectedDay.value;
  const arr = kind === "pickup" ? draftPickup.value : draftDropoff.value;
  arr.push({ id: genStopId(kind, dayKey), time: "", place: "" });
  if (!isEditing.value) commitIfChanged();
}

function removeStop(kind, idx) {
  const arr = kind === "pickup" ? draftPickup.value : draftDropoff.value;
  arr.splice(idx, 1);
  if (!isEditing.value) commitIfChanged();
}

function stopsEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const aid = (a[i]?.id ?? "").toString();
    const at = (a[i]?.time ?? "").toString();
    const ap = (a[i]?.place ?? "").toString();
    const bid = (b[i]?.id ?? "").toString();
    const bt = (b[i]?.time ?? "").toString();
    const bp = (b[i]?.place ?? "").toString();
    if (aid !== bid || at !== bt || ap !== bp) return false;
  }
  return true;
}

function ensureDayObj(dayKey) {
  if (!store.state.public.routes) store.state.public.routes = {};
  if (!store.state.public.routes[dayKey]) store.state.public.routes[dayKey] = { pickup: [], dropoff: [] };
  if (!Array.isArray(store.state.public.routes[dayKey].pickup)) store.state.public.routes[dayKey].pickup = [];
  if (!Array.isArray(store.state.public.routes[dayKey].dropoff)) store.state.public.routes[dayKey].dropoff = [];
}

function commitIfChanged() {
  if (isEditing.value) return;

  const puChanged = !stopsEqual(draftPickup.value, snapPickup.value);
  const doChanged = !stopsEqual(draftDropoff.value, snapDropoff.value);
  if (!puChanged && !doChanged) return;

  ensureDayObj(selectedDay.value);

  // ✅ 시간 기준 정렬 적용 (저장 시점에만)
  const puSortedDraft = sortStopsByTime(draftPickup.value);
  const doSortedDraft = sortStopsByTime(draftDropoff.value);

  const pu = puSortedDraft.map((s) => ({
    id: (s.id ?? "").toString() || genStopId("pickup", selectedDay.value),
    time: (s.time ?? "").toString(),
    place: (s.place ?? "").toString(),
  }));

  const dof = doSortedDraft.map((s) => ({
    id: (s.id ?? "").toString() || genStopId("dropoff", selectedDay.value),
    time: (s.time ?? "").toString(),
    place: (s.place ?? "").toString(),
  }));

  store.state.public.routes[selectedDay.value].pickup = pu;
  store.state.public.routes[selectedDay.value].dropoff = dof;

  // ✅ UI도 정렬된 상태로 맞춤 (저장 후에만 재배열)
  draftPickup.value = deepCloneStops(normalizeStops(pu));
  draftDropoff.value = deepCloneStops(normalizeStops(dof));

  snapPickup.value = deepCloneStops(normalizeStops(pu));
  snapDropoff.value = deepCloneStops(normalizeStops(dof));
}

watch(
  () => store.state.public.routes,
  (r) => {
    const rr = r || {};
    const firstHasData =
      days.find((d) => {
        const day = rr?.[d.key];
        return (day?.pickup?.length || 0) + (day?.dropoff?.length || 0) > 0;
      })?.key || "mon";
    if (selectedDay.value === "mon") selectedDay.value = firstHasData;
  },
  { immediate: true }
);
</script>

<style scoped>
.box {
  padding: 14px;
}

.note {
  margin: 12px 0 0;
  font-size: 12px;
  opacity: 0.65;
  line-height: 1.5;
}

.minihelp {
  font-size: 12px;
  opacity: 0.7;
  line-height: 1.5;
  margin-top: 6px;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 2px 0 10px;
}

.subhead {
  font-size: 12px;
  font-weight: 1000;
  letter-spacing: 0.4px;
  opacity: 0.9;
  margin: 0;
}

.tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.tab {
  border: 1px solid rgba(255, 255, 255, 0.10);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.9);
  font-size: 11px;
  font-weight: 1000;
  padding: 7px 10px;
  border-radius: 999px;
  cursor: pointer;
}
.tab.on {
  border-color: rgba(255, 255, 255, 0.22);
  background: rgba(255, 255, 255, 0.08);
}

.daypanel {
  margin-top: 6px;
}

.subgroup {
  margin-bottom: 14px;
}

.subtag {
  display: inline-block;
  font-size: 11px;
  font-weight: 1000;
  padding: 6px 10px;
  border-radius: 999px;
  margin-bottom: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.03);
}
.subtag.pickup {
  color: #6cffc0;
  border-color: rgba(0, 200, 120, 0.3);
  background: rgba(0, 200, 120, 0.1);
}
.subtag.dropoff {
  color: #ffd7a6;
  border-color: rgba(255, 159, 67, 0.32);
  background: rgba(255, 159, 67, 0.1);
}

.list {
  display: grid;
  gap: 8px;
}

/* ✅ 빠른 추가 영역 */
.quickAdd {
  display: grid;
  grid-template-columns: 92px 110px minmax(0, 1fr) 64px;
  gap: 10px;
  align-items: center;
  padding: 10px 10px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.12);
  margin: 6px 0 12px;
  overflow: hidden;
}

/* 아주 좁으면 2줄 */
@media (max-width: 520px) {
  .quickAdd {
    grid-template-columns: 1fr 64px;
    grid-template-areas:
      "kind add"
      "time add"
      "place add";
    row-gap: 8px;
  }
  .sel {
    grid-area: kind;
  }
  .quickAdd .inp.time {
    grid-area: time;
  }
  .quickAdd .inp.place {
    grid-area: place;
  }
  .addBtn {
    grid-area: add;
    align-self: stretch;
    height: auto;
  }
}

/* 기존 겹침 방지 셋 */
.rowitem {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr) 64px;
  gap: 10px;
  align-items: center;
  padding: 10px 10px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.12);
  overflow: hidden;
}

.rowitem,
.rowitem * ,
.quickAdd,
.quickAdd * {
  box-sizing: border-box;
}

@media (max-width: 520px) {
  .rowitem {
    grid-template-columns: 1fr 64px;
    grid-template-areas:
      "time del"
      "place del";
    row-gap: 8px;
  }
  .inp.time {
    grid-area: time;
  }
  .inp.place {
    grid-area: place;
  }
  .del {
    grid-area: del;
    align-self: stretch;
    height: auto;
  }
}

.sel {
  width: 100%;
  height: 34px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.10);
  background: rgba(0, 0, 0, 0.18);
  color: rgba(255, 255, 255, 0.92);
  padding: 0 10px;
  outline: none;
  font-size: 12px;
  min-width: 0;
  max-width: 100%;
  font-weight: 1000;
}

.inp {
  width: 100%;
  height: 34px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.10);
  background: rgba(0, 0, 0, 0.18);
  color: rgba(255, 255, 255, 0.92);
  padding: 0 10px;
  outline: none;
  font-size: 12px;
  min-width: 0;
  max-width: 100%;
}
.inp:focus,
.sel:focus {
  border-color: rgba(255, 255, 255, 0.22);
}
.inp.time {
  font-weight: 1000;
  font-variant-numeric: tabular-nums;
}

.del,
.addBtn {
  width: 100%;
  min-width: 64px;
  max-width: 100%;
  height: 34px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.10);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.85);
  font-size: 11px;
  font-weight: 1000;
  cursor: pointer;
  white-space: nowrap;
}

.add {
  height: 34px;
  border-radius: 12px;
  border: 1px dashed rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.03);
  color: rgba(255, 255, 255, 0.80);
  font-size: 12px;
  font-weight: 1000;
  cursor: pointer;
}

.emptymini {
  font-size: 12px;
  opacity: 0.55;
  padding: 10px 0 0;
}
</style>
