<!-- FILE: src/components/settings/SettingsRosterTrialPanel.vue -->
<template>
  <section class="card">
    <div class="box">
      <div class="minihelp" v-if="isLoading">데이터 로드 중…</div>
      <div class="minihelp" v-else-if="loadError">로드 오류: {{ loadError }}</div>

      <template v-else>
        <!-- ✅ 날짜 -->
        <div class="datebar">
          <div class="subhead">예약 (날짜 기준)</div>

          <div class="dategrid">
            <div class="lab">날짜</div>
            <input class="inp" type="date" v-model="selectedDateInput" />
            <button class="ghost" type="button" @click="setToToday" :disabled="!activeYmd">
              오늘로
            </button>
          </div>

          <div class="minihelp dim">
            선택 날짜: <b>{{ selectedYmd || "—" }}</b>
            <span v-if="selectedYmd" class="dim">
              · 요일: <b>{{ dayLabelKr }}</b>
              · 기본노선: <b>{{ pickupStops.length }}</b>승차 / <b>{{ dropoffStops.length }}</b>하차
            </span>
          </div>
        </div>

        <div class="sep"></div>

        <!-- ✅ 추가 폼 -->
        <div class="formbox">
          <div class="subhead">예약 추가</div>

          <!-- 예약사유 -->
          <div class="row">
            <div class="lab">예약사유</div>
            <div class="selectwrap">
              <select class="inp sel" v-model="form.reasonType">
                <option value="보강">보강</option>
                <option value="시간변경">시간변경</option>
                <option value="체험">체험</option>
                <option value="사용자텍스트지정">사용자텍스트지정</option>
                <option value="결석">결석</option>
              </select>
              <span class="chev">▾</span>
            </div>
          </div>

          <div v-if="form.reasonType === '사용자텍스트지정'" class="row">
            <div class="lab">사유입력</div>
            <input class="inp" v-model="form.reasonText" type="text" placeholder="예: 픽업 장소 변경" />
          </div>

          <!-- 이름 -->
          <div v-if="isTrial" class="row">
            <div class="lab">이름</div>
            <input class="inp" v-model="form.tempName" type="text" placeholder="예: 홍길동(체험)" />
          </div>

          <div v-else class="row">
            <div class="lab">이름</div>

            <div class="picker">
              <input
                class="inp"
                v-model="personQuery"
                type="text"
                placeholder="명단 검색 (이름 입력)…"
                @focus="personOpen = true"
              />

              <button class="ghost small" type="button" @click="togglePersonOpen" :disabled="!people.length">
                {{ personOpen ? "닫기" : "목록" }}
              </button>

              <div v-if="personOpen" class="dropdown">
                <div v-if="!people.length" class="dd-empty">명단 데이터가 없어.</div>

                <button
                  v-for="p in filteredPeople"
                  :key="p.id"
                  type="button"
                  class="dd-item"
                  @click="selectPerson(p)"
                >
                  <span class="dd-name">{{ p.name }}</span>
                  <span class="dd-sub">{{ p.id }}</span>
                </button>

                <div v-if="people.length && !filteredPeople.length" class="dd-empty">
                  검색 결과가 없어.
                </div>
              </div>
            </div>
          </div>

          <div v-if="!isTrial" class="minihelp dim">
            선택됨: <b>{{ selectedPersonName || "—" }}</b>
            <span v-if="selectedPersonId" class="pid">({{ selectedPersonId }})</span>
          </div>

          <div class="sep soft"></div>

          <!-- ✅ 결석 안내 -->
          <div v-if="isAbsent" class="minihelp dim">
            결석은 선택된 사람을 <b>차량명단(기본/예약)에서 완전히 제외</b>해.
            (승차/하차 선택 없이 저장 가능)
          </div>

          <!-- ✅ 승차: 장소 드랍 + 시간 자동 -->
          <div class="subrow" :class="{ disabled: isAbsent }">
            <div class="lab">승차</div>
            <div class="grid2">
              <div class="selectwrap">
                <select
                  class="inp sel"
                  v-model="form.pickupStopId"
                  :disabled="isAbsent || !pickupStops.length"
                >
                  <option value="">승차 장소 선택…</option>
                  <option v-for="s in pickupStops" :key="'pu-' + s.id" :value="s.id">
                    {{ s.place }}
                  </option>
                </select>
                <span class="chev">▾</span>
              </div>
              <input class="inp ro" :value="pickupTimeView" type="text" readonly />
            </div>
          </div>

          <!-- ✅ 하차: 장소 드랍 + 시간 자동 -->
          <div class="subrow" :class="{ disabled: isAbsent }">
            <div class="lab">하차</div>
            <div class="grid2">
              <div class="selectwrap">
                <select
                  class="inp sel"
                  v-model="form.dropoffStopId"
                  :disabled="isAbsent || !dropoffStops.length"
                >
                  <option value="">하차 장소 선택…</option>
                  <option v-for="s in dropoffStops" :key="'do-' + s.id" :value="s.id">
                    {{ s.place }}
                  </option>
                </select>
                <span class="chev">▾</span>
              </div>
              <input class="inp ro" :value="dropoffTimeView" type="text" readonly />
            </div>
          </div>

          <div class="minihelp dim" v-if="!isAbsent">
            장소는 선택 날짜의 요일 기준 기본노선에서 고르고, 시간은 해당 기본노선 시간으로 자동 로드돼.
            (승차/하차 둘 중 하나만 선택해도 됨)
          </div>

          <!-- 액션 -->
          <div class="actions">
            <button class="btn" type="button" @click="onAdd" :disabled="!canAdd || isSaving">
              {{ isSaving ? "저장중…" : "예약 추가" }}
            </button>
            <button class="ghost" type="button" @click="onReset" :disabled="isSaving">초기화</button>
          </div>

          <div class="minihelp dim">
            ※ 추가/삭제는 store에 저장되고, public(reservations) 스냅샷으로 자동 로드돼.
          </div>
        </div>

        <div class="sep"></div>

        <!-- ✅ 리스트 -->
        <div class="subhead">선택 날짜 예약 목록</div>
        <div class="minihelp"><b>{{ selectedYmd || "—" }}</b> 의 예약만 보여줘.</div>

        <div class="resbox">
          <div class="kv">
            <div class="k">총 예약 수</div>
            <div class="v">{{ reservationsForSelectedDay.length }}</div>
          </div>

          <div v-if="reservationsForSelectedDay.length" class="reslist">
            <div v-for="r in reservationsForSelectedDay" :key="r._key" class="rescard">
              <div class="reshead">
                <div class="resname">
                  {{ r.displayName }}
                  <span v-if="r.isTrial" class="tag">체험</span>
                  <span v-if="r.isAbsent" class="tag dangerTag">결석</span>
                </div>
                <div class="respid">
                  {{ r.isTrial ? "임시" : (r.personId || "—") }}
                </div>
              </div>

              <div class="resitems">
                <div class="resitem">
                  <!-- ✅ 배지: 보강/시간변경/사용자텍스트(입력값)/결석 -->
                  <span class="r-badge" :class="{ dangerBadge: r.isAbsent }">{{ r.reasonLabel }}</span>

                  <span class="r-text">
                    <!-- 결석이면 라인 표시 생략 -->
                    <span v-if="r.isAbsent">차량명단에서 제외</span>

                    <template v-else>
                      <span v-if="r.pickup && r.pickup.place">
                        <b>승차</b> · {{ r.pickup.time || "—" }} · {{ r.pickup.place }}
                      </span>
                      <span v-if="r.pickup && r.pickup.place && r.dropoff && r.dropoff.place">  |  </span>
                      <span v-if="r.dropoff && r.dropoff.place">
                        <b>하차</b> · {{ r.dropoff.time || "—" }} · {{ r.dropoff.place }}
                      </span>
                      <span v-if="(!r.pickup || !r.pickup.place) && (!r.dropoff || !r.dropoff.place)">—</span>
                    </template>
                  </span>
                </div>
              </div>

              <div class="card-actions">
                <button class="danger small" type="button" @click="onDelete(r)" :disabled="isSaving">
                  삭제
                </button>
              </div>
            </div>
          </div>

          <div v-else class="emptymini">해당 날짜에 예약이 없어.</div>
        </div>
      </template>
    </div>
  </section>
</template>

<script setup>
import { computed, reactive, ref, watch } from "vue";
import { useAppStore } from "@/store/jumpersStore";

const store = useAppStore();

/** loading/error */
const isLoading = computed(() => !!(store.state.loadingPublic || store.state.loadingDone));
const loadError = computed(() => store.state.errorPublic || store.state.errorDone || "");

const isSaving = ref(false);

function safeStr(v) {
  return typeof v === "string" ? v : "";
}
function safeArr(v) {
  return Array.isArray(v) ? v : [];
}

/** today + selected date */
const activeYmd = computed(() => store.todayYmd?.value || "");

const selectedYmd = ref("");
watch(
  activeYmd,
  (v) => {
    if (!selectedYmd.value && v) selectedYmd.value = v;
  },
  { immediate: true }
);

const selectedDateInput = computed({
  get() {
    return selectedYmd.value || "";
  },
  set(v) {
    selectedYmd.value = safeStr(v);
  },
});

function setToToday() {
  if (activeYmd.value) selectedYmd.value = activeYmd.value;
}

/** weekday */
const dayIndex = computed(() => {
  const ymd = selectedYmd.value;
  if (!ymd) return -1;
  const [y, m, d] = ymd.split("-").map((x) => parseInt(x, 10));
  if (!y || !m || !d) return -1;
  return new Date(y, m - 1, d).getDay(); // 0=일..6=토
});

const dayKey = computed(() => {
  const i = dayIndex.value;
  if (i < 0) return "";
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][i];
});

const dayLabelKr = computed(() => {
  const i = dayIndex.value;
  if (i < 0) return "";
  return ["일", "월", "화", "수", "목", "금", "토"][i] + "요일";
});

/** ✅ 기본노선 */
const routes = computed(() => store.state.public.routes || {});
const dayRoute = computed(() => routes.value?.[dayKey.value] || { pickup: [], dropoff: [] });

function normalizeStops(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((s, idx) => ({
    id: safeStr(s?.id).trim() || `${idx}`,
    time: safeStr(s?.time).trim(),
    place: safeStr(s?.place).trim(),
  }));
}

const pickupStops = computed(() => normalizeStops(dayRoute.value.pickup));
const dropoffStops = computed(() => normalizeStops(dayRoute.value.dropoff));

const pickupById = computed(() => {
  const map = new Map();
  for (const s of pickupStops.value) map.set(s.id, s);
  return map;
});
const dropoffById = computed(() => {
  const map = new Map();
  for (const s of dropoffStops.value) map.set(s.id, s);
  return map;
});

/** roster people */
const peopleRaw = computed(() => {
  const p1 = store.state.public?.people;
  const p2 = store.state.public?.roster;
  const p3 = store.state.public?.persons;
  return safeArr(p1?.list || p1 || p2?.list || p2 || p3?.list || p3);
});

const people = computed(() => {
  return peopleRaw.value
    .map((p) => {
      const id = safeStr(p?.id || p?.personId || p?.uid).trim();
      const name = safeStr(p?.name || p?.displayName || p?.label).trim();
      if (!id && !name) return null;
      return { id: id || name, name: name || id };
    })
    .filter(Boolean);
});

const peopleById = computed(() => {
  const map = new Map();
  for (const p of people.value) map.set(p.id, p);
  return map;
});

/** person picker */
const personQuery = ref("");
const personOpen = ref(false);
const selectedPersonId = ref("");

const filteredPeople = computed(() => {
  const q = safeStr(personQuery.value).trim().toLowerCase();
  if (!q) return people.value.slice(0, 50);
  return people.value
    .filter((p) => (p.name || "").toLowerCase().includes(q) || (p.id || "").toLowerCase().includes(q))
    .slice(0, 50);
});

function togglePersonOpen() {
  personOpen.value = !personOpen.value;
}

const selectedPersonName = computed(() => {
  if (!selectedPersonId.value) return "";
  return peopleById.value.get(selectedPersonId.value)?.name || "";
});

function selectPerson(p) {
  selectedPersonId.value = p.id;
  personQuery.value = p.name;
  personOpen.value = false;
}

/** form */
const form = reactive({
  reasonType: "보강", // 보강 | 시간변경 | 체험 | 사용자텍스트지정 | 결석
  reasonText: "",
  tempName: "",
  pickupStopId: "",
  dropoffStopId: "",
});

const isTrial = computed(() => form.reasonType === "체험");
const isAbsent = computed(() => form.reasonType === "결석");

watch(
  () => form.reasonType,
  (v) => {
    if (v === "체험") {
      selectedPersonId.value = "";
      personQuery.value = "";
      personOpen.value = false;
    } else {
      form.tempName = "";
    }

    if (v !== "사용자텍스트지정") form.reasonText = "";

    // ✅ 결석이면 승/하차 선택 의미없음 → 초기화
    if (v === "결석") {
      form.pickupStopId = "";
      form.dropoffStopId = "";
    }
  }
);

/** date 바뀌면 선택된 stop 초기화 */
watch(
  () => dayKey.value,
  () => {
    form.pickupStopId = "";
    form.dropoffStopId = "";
  }
);

const pickupTimeView = computed(() => {
  if (!form.pickupStopId) return "—";
  return pickupById.value.get(form.pickupStopId)?.time || "—";
});
const dropoffTimeView = computed(() => {
  if (!form.dropoffStopId) return "—";
  return dropoffById.value.get(form.dropoffStopId)?.time || "—";
});

/** reservations list */
const reservations = computed(() => safeArr(store.state.public?.reservations));

function mapReasonLabelFromStore(r) {
  const code = safeStr(r?.reason).trim();

  if (code === "absent") return "결석";
  if (code === "supplement") return "보강";
  if (code === "timeChange") return "시간변경";
  if (code === "custom") {
    return (
      safeStr(r?.customText).trim() ||
      safeStr(r?.reasonText).trim() ||
      "사용자텍스트"
    );
  }

  // fallback (old data)
  const rt = safeStr(r?.reasonType || r?.kind || r?.reasonTypeLabel).trim();
  if (rt === "사용자텍스트지정") return safeStr(r?.reasonText || r?.customKind).trim() || "사용자텍스트";
  if (rt) return rt;

  return "보강";
}

const reservationsForSelectedDay = computed(() => {
  const ymd = selectedYmd.value;
  if (!ymd) return [];

  const list = reservations.value.filter((r) => safeStr(r?.date) === ymd);

  return list.map((r, idx) => {
    const id = safeStr(r?.id).trim();
    const key = id || `${ymd}-${idx}`;

    const pid = safeStr(r?.personId).trim();
    const isTrialRow = !pid && safeStr(r?.kind).trim() === "체험";
    const isAbsentRow = safeStr(r?.reason).trim() === "absent" || safeStr(r?.kind).trim() === "결석" || !!r?.absent;

    const displayName = isTrialRow
      ? safeStr(r?.tempName).trim() || "체험"
      : (peopleById.value.get(pid)?.name || pid || "—");

    const reasonLabel = mapReasonLabelFromStore(r);

    // 새 구조 pickup/dropoff 우선
    const pickup = r?.pickup?.place
      ? { place: safeStr(r.pickup.place), time: safeStr(r.pickup.time) }
      : safeStr(r?.pickupPlace).trim()
      ? { place: safeStr(r?.pickupPlace), time: safeStr(r?.pickupTime) }
      : null;

    const dropoff = r?.dropoff?.place
      ? { place: safeStr(r.dropoff.place), time: safeStr(r.dropoff.time) }
      : safeStr(r?.dropoffPlace).trim()
      ? { place: safeStr(r?.dropoffPlace), time: safeStr(r?.dropoffTime) }
      : null;

    return {
      ...r,
      _key: key,
      id: id || "",

      personId: pid,
      isTrial: isTrialRow,
      isAbsent: isAbsentRow,

      displayName,
      reasonLabel,
      pickup,
      dropoff,
    };
  });
});

/** can add */
const canAdd = computed(() => {
  if (!selectedYmd.value) return false;

  // 이름
  if (isTrial.value) {
    if (!form.tempName.trim()) return false;
  } else {
    if (!selectedPersonId.value.trim()) return false;
  }

  // ✅ 결석은 승/하차 선택 없이 가능
  if (isAbsent.value) return true;

  // 승차/하차 중 최소 하나
  if (!form.pickupStopId && !form.dropoffStopId) return false;

  // 사용자텍스트지정이면 텍스트 필수로 하고 싶으면 아래 주석 해제
  // if (form.reasonType === "사용자텍스트지정" && !form.reasonText.trim()) return false;

  return true;
});

function onReset() {
  form.reasonType = "보강";
  form.reasonText = "";
  form.tempName = "";
  form.pickupStopId = "";
  form.dropoffStopId = "";

  selectedPersonId.value = "";
  personQuery.value = "";
  personOpen.value = false;
}

async function onAdd() {
  if (!canAdd.value) return;

  const pu = pickupById.value.get(form.pickupStopId);
  const dof = dropoffById.value.get(form.dropoffStopId);

  const payload = {
    date: selectedYmd.value,

    reasonType: form.reasonType,
    reasonText: form.reasonType === "사용자텍스트지정" ? form.reasonText.trim() : "",

    personId: isTrial.value ? "" : selectedPersonId.value,
    tempName: isTrial.value ? form.tempName.trim() : "",

    // ✅ 결석이면 null
    pickup: isAbsent.value
      ? null
      : (form.pickupStopId
          ? { stopId: form.pickupStopId, place: pu?.place || "", time: pu?.time || "" }
          : null),

    dropoff: isAbsent.value
      ? null
      : (form.dropoffStopId
          ? { stopId: form.dropoffStopId, place: dof?.place || "", time: dof?.time || "" }
          : null),
  };

  isSaving.value = true;
  try {
    store.addReservation(payload);
    onReset();
  } finally {
    isSaving.value = false;
  }
}

async function onDelete(r) {
  const rid = safeStr(r?.id || r?._key).trim();
  if (!rid) return;

  isSaving.value = true;
  try {
    store.deleteReservation(rid);
  } finally {
    isSaving.value = false;
  }
}
</script>

<style scoped>
.card {
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  overflow: hidden;
}

/* ✅ 박스 안으로 사이징 고정 */
.box,
.box * {
  box-sizing: border-box;
}
.box {
  padding: 14px;
  min-width: 0;
}

/* text */
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
  opacity: 0.95;
  margin: 2px 0 10px;
}
.dim {
  opacity: 0.7;
}
.pid {
  opacity: 0.65;
  margin-left: 6px;
}

/* separators */
.sep {
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
  margin: 14px 0;
}
.sep.soft {
  background: rgba(255, 255, 255, 0.06);
  margin: 10px 0;
}

/* date bar */
.datebar {
  display: grid;
  gap: 8px;
}
.dategrid {
  display: grid;
  grid-template-columns: 70px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  min-width: 0;
}

/* form */
.formbox {
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.16);
  padding: 12px;
  display: grid;
  gap: 10px;
  min-width: 0;
}
.row {
  display: grid;
  grid-template-columns: 70px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  min-width: 0;
}
.lab {
  font-size: 12px;
  font-weight: 1000;
  opacity: 0.85;
}

/* ✅ 승차/하차 행 */
.subrow {
  display: grid;
  grid-template-columns: 70px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  min-width: 0;
}
.subrow.disabled {
  opacity: 0.55;
}
.grid2 {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 120px;
  gap: 10px;
  align-items: center;
  min-width: 0;
}
@media (max-width: 520px) {
  .grid2 {
    grid-template-columns: 1fr;
  }
}

/* inputs */
.inp {
  width: 100%;
  height: 40px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(10, 10, 10, 0.55);
  color: inherit;
  padding: 0 12px;
  outline: none;
  min-width: 0;
}
.inp::placeholder {
  opacity: 0.55;
}
.inp:focus {
  border-color: rgba(255, 196, 92, 0.45);
  box-shadow: 0 0 0 3px rgba(255, 196, 92, 0.12);
}
.ro {
  opacity: 0.9;
}

/* ✅ select visible */
.selectwrap {
  position: relative;
  display: block;
  min-width: 0;
}
.sel {
  -webkit-appearance: none;
  appearance: none;
  padding-right: 34px;
  background: rgba(20, 20, 20, 0.82);
  border-color: rgba(255, 255, 255, 0.26);
}
.chev {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 12px;
  opacity: 0.85;
  pointer-events: none;
}

/* actions */
.actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
  min-width: 0;
}
.btn,
.ghost,
.danger {
  height: 38px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.14);
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
.danger {
  border-color: rgba(255, 90, 90, 0.28);
  background: rgba(255, 90, 90, 0.12);
}
.btn:active,
.ghost:active,
.danger:active {
  transform: translateY(1px);
}
.small {
  height: 32px;
  border-radius: 12px;
  padding: 0 10px;
  font-size: 12px;
}

/* people picker */
.picker {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  min-width: 0;
}
.dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  z-index: 9999;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(18, 18, 18, 0.96);
  overflow: hidden;
  max-height: 260px;
  overflow-y: auto;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45);
}
.dd-item {
  width: 100%;
  text-align: left;
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  background: transparent;
  border: 0;
  color: inherit;
  cursor: pointer;
}
.dd-item:hover {
  background: rgba(255, 255, 255, 0.06);
}
.dd-name {
  font-weight: 1000;
  font-size: 12px;
}
.dd-sub {
  font-size: 11px;
  opacity: 0.65;
}
.dd-empty {
  padding: 10px 12px;
  font-size: 12px;
  opacity: 0.65;
}

/* list */
.resbox {
  display: grid;
  gap: 10px;
  min-width: 0;
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
  min-width: 0;
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
  display: flex;
  gap: 8px;
  align-items: center;
}
.tag {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid rgba(255, 196, 92, 0.22);
  background: rgba(255, 196, 92, 0.14);
  font-weight: 1000;
  opacity: 0.95;
}
.dangerTag {
  border-color: rgba(255, 90, 90, 0.28);
  background: rgba(255, 90, 90, 0.12);
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
.dangerBadge {
  border-color: rgba(255, 90, 90, 0.28);
  background: rgba(255, 90, 90, 0.12);
}
.r-text {
  font-size: 12px;
  opacity: 0.9;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
}
.emptymini {
  font-size: 12px;
  opacity: 0.55;
  padding: 10px 0 0;
}
</style>
