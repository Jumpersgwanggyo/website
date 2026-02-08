<!-- FILE: src/components/settings/SettingsRosterReservePanel.vue -->
<template>
  <section class="card">
    <SettingsRosterReserveTabsHeader v-model="tab" :dayLabel="activeYmd" />

    <div class="box">
      <div class="minihelp" v-if="isLoading">데이터 로드 중…</div>
      <div class="minihelp" v-else-if="loadError">로드 오류: {{ loadError }}</div>

      <template v-else>
        <template v-if="tab === 'roster'">
          <!-- =========================
               선택된 사람: 이름 + 요일별 장소/시간
               ========================= -->
          <template v-if="selectedPersonId">
            <div class="namebar">
              <input
                class="nameinput"
                type="text"
                v-model.trim="editName"
                :placeholder="selectedPersonId"
                @keydown.enter.prevent="commitName"
                @blur="commitName"
              />
            </div>

            <div class="daylist">
              <div v-for="d in weekDays" :key="'day-' + d.key" class="daycard">
                <div class="dayhead">
                  <span class="daylabel">{{ d.label }}</span>
                </div>

                <div class="dayrows">
                  <div class="drow">
                    <span class="chip k">승</span>
                    <select
                      class="placeSelect"
                      :value="pickedAssign(dayKeyNorm(d.key)).pickupPlace || ''"
                      @change="onChangeAssignPlace(dayKeyNorm(d.key), 'pickup', $event.target.value)"
                    >
                      <option value="">—</option>
                      <option
                        v-for="opt in placeOptionsByDay(dayKeyNorm(d.key), 'pickup')"
                        :key="'pu-' + dayKeyNorm(d.key) + '-' + opt"
                        :value="opt"
                      >
                        {{ opt }}
                      </option>
                    </select>
                    <span class="time">{{ pickedAssign(dayKeyNorm(d.key)).pickupTime || "—" }}</span>
                  </div>

                  <div class="drow">
                    <span class="chip k">하</span>
                    <select
                      class="placeSelect"
                      :value="pickedAssign(dayKeyNorm(d.key)).dropoffPlace || ''"
                      @change="onChangeAssignPlace(dayKeyNorm(d.key), 'dropoff', $event.target.value)"
                    >
                      <option value="">—</option>
                      <option
                        v-for="opt in placeOptionsByDay(dayKeyNorm(d.key), 'dropoff')"
                        :key="'do-' + dayKeyNorm(d.key) + '-' + opt"
                        :value="opt"
                      >
                        {{ opt }}
                      </option>
                    </select>
                    <span class="time">{{ pickedAssign(dayKeyNorm(d.key)).dropoffTime || "—" }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="sep"></div>
          </template>

          <!-- =========================
               선택 없을 때: 기존 전체 명단 그리드
               ========================= -->
          <template v-else>
            <div class="subhead">월~금 장소 체크</div>
            <div class="minihelp">각 사람의 요일별 승/하차 장소(people.assign)를 그대로 보여줘.</div>

            <div class="gridwrap">
              <div class="gridhead">
                <div class="g-name">이름</div>
                <div v-for="d in weekDays" :key="'h-' + d.key" class="g-day">
                  {{ d.label }}
                </div>
              </div>

              <div v-if="peopleRowsToShow.length === 0" class="emptymini">표시할 명단이 없어.</div>

              <div v-for="p in peopleRowsToShow" :key="'p-' + p.id" class="gridrow">
                <div class="g-name">
                  <div class="pname">{{ p.name }}</div>
                </div>

                <div v-for="d in weekDays" :key="p.id + '-' + d.key" class="g-day">
                  <div class="chipline">
                    <span class="chip k">승</span>
                    <span class="chip v">{{ p.assign?.[dayKeyNorm(d.key)]?.pickupPlace || "—" }}</span>
                  </div>
                  <div class="chipline">
                    <span class="chip k">하</span>
                    <span class="chip v">{{ p.assign?.[dayKeyNorm(d.key)]?.dropoffPlace || "—" }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="sep"></div>
          </template>

          <!-- =========================
               ✅ 예약 현황
               ========================= -->
          <div class="subhead">예약 현황</div>

          <div class="resbox">
            <template v-if="selectedPersonId">
              <div class="topbar">
                <div class="toprow">
                  <span class="chip k">사유</span>
                  <select class="selDark" v-model="raReason">
                    <option value="supplement">보강</option>
                    <option value="timeChange">시간변경</option>
                    <option value="custom">사용자 텍스트 저장</option>
                    <option value="absent">결석</option>
                  </select>
                </div>

                <div class="toprow">
                  <span class="chip k">날짜</span>
                  <input class="dateInp" type="date" v-model="resDateIso" />
                  <span class="chip k">요일</span>
                  <span class="daypill">{{ dayLabelByKey(resDayKey) }}</span>
                </div>
              </div>

              <div v-if="raReason === 'absent'" class="absentNote">
                결석은 예약 추가/저장/표시에서 완전 제외.
              </div>

              <div v-else class="resAddDual">
                <div class="dualrow">
                  <div class="cell">
                    <div class="lab">승차 장소</div>
                    <select class="selDark" v-model="raPickupPlace" @change="syncAddTimes">
                      <option value="">—</option>
                      <option v-for="opt in pickupPlaceOptions" :key="'apu-' + opt" :value="opt">
                        {{ opt }}
                      </option>
                    </select>
                    <div class="timePill">{{ raPickupTime || "—" }}</div>
                  </div>

                  <div class="cell">
                    <div class="lab">하차 장소</div>
                    <select class="selDark" v-model="raDropoffPlace" @change="syncAddTimes">
                      <option value="">—</option>
                      <option v-for="opt in dropoffPlaceOptions" :key="'ado-' + opt" :value="opt">
                        {{ opt }}
                      </option>
                    </select>
                    <div class="timePill">{{ raDropoffTime || "—" }}</div>
                  </div>
                </div>

                <div class="dualrow" v-if="raReason === 'custom'">
                  <div class="cell full">
                    <div class="lab">텍스트</div>
                    <input class="inpDark" v-model.trim="raText" placeholder="텍스트" />
                  </div>
                </div>

                <div class="dualrow actions">
                  <button class="btnAdd" type="button" @click="addReservationDual">추가</button>
                </div>

                <div class="minihelp2">승차/하차 둘 중 하나만 선택해도 저장되고, 둘 다 선택도 가능해.</div>
              </div>
            </template>

            <div class="kv">
              <div class="k">총 예약 수</div>
              <div class="v">{{ reservationsForDayFiltered.length }}</div>
            </div>

            <template v-if="selectedPersonId">
              <div v-if="reservationsForDayFiltered.length === 0" class="emptymini">해당 날짜 예약이 없어.</div>

              <div v-else class="resEditList">
                <div v-for="(r, idx) in reservationsForDayFiltered" :key="r.id || ('r-' + idx)" class="resEditRowDual">
                  <div class="rowTop">
                    <select
                      class="selDark"
                      :value="normalizeReason(r)"
                      @change="updateReservationDualField(idx, 'reason', $event.target.value)"
                    >
                      <option value="supplement">보강</option>
                      <option value="timeChange">시간변경</option>
                      <option value="custom">사용자 텍스트 저장</option>
                    </select>

                    <button class="btnDel" type="button" @click="removeReservation(idx)">삭제</button>
                  </div>

                  <div class="dualrow">
                    <div class="cell">
                      <div class="lab">승차 장소</div>
                      <select
                        class="selDark"
                        :value="normalizePickupPlace(r)"
                        @change="updateReservationDualPlace(idx, 'pickup', $event.target.value)"
                      >
                        <option value="">—</option>
                        <option v-for="opt in pickupPlaceOptions" :key="'epu-' + idx + '-' + opt" :value="opt">
                          {{ opt }}
                        </option>
                      </select>
                      <div class="timePill">{{ normalizePickupTime(r) || "—" }}</div>
                    </div>

                    <div class="cell">
                      <div class="lab">하차 장소</div>
                      <select
                        class="selDark"
                        :value="normalizeDropoffPlace(r)"
                        @change="updateReservationDualPlace(idx, 'dropoff', $event.target.value)"
                      >
                        <option value="">—</option>
                        <option v-for="opt in dropoffPlaceOptions" :key="'edo-' + idx + '-' + opt" :value="opt">
                          {{ opt }}
                        </option>
                      </select>
                      <div class="timePill">{{ normalizeDropoffTime(r) || "—" }}</div>
                    </div>
                  </div>

                  <div class="dualrow" v-if="normalizeReason(r) === 'custom'">
                    <div class="cell full">
                      <div class="lab">텍스트</div>
                      <input
                        class="inpDark"
                        :value="normalizeText(r)"
                        placeholder="텍스트"
                        @input="updateReservationDualField(idx, 'text', $event.target.value)"
                        @blur="commitReservationsImmediate"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <template v-else>
              <div class="reslist" v-if="Object.keys(reservationsByPersonFiltered).length">
                <div v-for="(items, pid) in reservationsByPersonFiltered" :key="'rbp-' + pid" class="rescard">
                  <div class="reshead">
                    <div class="resname">
                      {{ personNameById(pid) }}
                      <span class="rescount">{{ items.length }}</span>
                    </div>
                    <div class="respid">ID: {{ pid }}</div>
                  </div>

                  <div class="resitems">
                    <div v-for="(x, i) in items" :key="'it-' + pid + '-' + i" class="resitem">
                      <span class="r-badge">{{ x.kind || "예약" }}</span>
                      <span class="r-text">
                        <b>{{ x.type === "dropoff" ? "하차" : "승차" }}</b>
                        · {{ x.time || "—" }} · {{ x.place || "—" }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div v-else class="emptymini">해당 조건의 예약이 없어.</div>

              <div v-if="tempReservations.length" class="sep2"></div>

              <div v-if="tempReservations.length">
                <div class="subhead" style="margin-top: 0;">체험/임시 예약</div>
                <div class="reslist">
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
              </div>
            </template>
          </div>
        </template>

        <template v-else>
          <SettingsRosterTrialPanel :initialTab="'trial'" />
        </template>
      </template>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { useAppStore } from "@/store/jumpersStore";
import SettingsRosterReserveTabsHeader from "@/components/settings/SettingsRosterReserveTabsHeader.vue";
import SettingsRosterTrialPanel from "@/components/settings/SettingsRosterTrialPanel.vue";

const props = defineProps({
  weekDays: { type: Array, required: true },
  selectedPersonId: { type: String, default: "" },
});

const store = useAppStore();

const isLoading = computed(() => !!(store.state.loadingPublic || store.state.loadingDone));
const loadError = computed(() => store.state.errorPublic || store.state.errorDone || "");
const activeYmd = computed(() => store.todayYmd?.value || "");

function safeStr(v) {
  return typeof v === "string" ? v : "";
}

/** ✅ 핵심 수정: 요일 key를 mon~fri로 강제 정규화 */
function dayKeyNorm(raw) {
  const s = safeStr(raw).trim().toLowerCase();
  if (!s) return "mon";

  // 이미 영문키면 그대로
  if (s === "mon" || s === "tue" || s === "wed" || s === "thu" || s === "fri") return s;

  // 한글 라벨이 들어오는 경우 정규화
  const map = { "월": "mon", "화": "tue", "수": "wed", "목": "thu", "금": "fri" };
  if (map[safeStr(raw).trim()]) return map[safeStr(raw).trim()];

  return "mon";
}

const tab = ref("roster");

/* date normalize */
function pad2(n) {
  return String(n).padStart(2, "0");
}
function parseYmdToDate(ymdRaw) {
  const s = safeStr(ymdRaw).trim();
  if (!s) return null;

  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) {
    const [y, m, d] = s.split("-").map((x) => parseInt(x, 10));
    return new Date(y, m - 1, d);
  }
  if (/^\d{4}\.\d{1,2}\.\d{1,2}$/.test(s)) {
    const [y, m, d] = s.split(".").map((x) => parseInt(x, 10));
    return new Date(y, m - 1, d);
  }
  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(s)) {
    const [y, m, d] = s.split("/").map((x) => parseInt(x, 10));
    return new Date(y, m - 1, d);
  }

  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}
function normIsoDate(ymdRaw) {
  const dt = parseYmdToDate(ymdRaw);
  if (!dt) return "";
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}
function isoToDayKey(iso) {
  const dt = parseYmdToDate(iso);
  if (!dt) return "mon";
  const dow = dt.getDay();
  const map = { 1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri" };
  return map[dow] || "mon";
}
function dayLabelByKey(k) {
  const map = { mon: "월", tue: "화", wed: "수", thu: "목", fri: "금" };
  return map[k] || "월";
}

/* calendar */
const resDateIso = ref("");
watch(
  () => activeYmd.value,
  (v) => {
    if (!resDateIso.value) resDateIso.value = normIsoDate(v) || "";
  },
  { immediate: true }
);
watch(
  () => props.selectedPersonId,
  () => {
    resDateIso.value = normIsoDate(activeYmd.value) || resDateIso.value || "";
  }
);
const resDayKey = computed(() => isoToDayKey(resDateIso.value || normIsoDate(activeYmd.value) || ""));

/* routes */
const routes = computed(() => store.state.public.routes || {});
function getRouteDay(dayKey) {
  const dk = dayKeyNorm(dayKey);
  const day = routes.value?.[dk];
  return {
    pickup: Array.isArray(day?.pickup) ? day.pickup : [],
    dropoff: Array.isArray(day?.dropoff) ? day.dropoff : [],
  };
}
function placeOptionsByDay(dayKey, type) {
  const dk = dayKeyNorm(dayKey);
  const tp = type === "dropoff" ? "dropoff" : "pickup";
  const day = getRouteDay(dk);
  const arr = tp === "pickup" ? day.pickup : day.dropoff;
  const set = new Set();
  for (const s of arr) {
    const place = safeStr(s?.place).trim();
    if (place) set.add(place);
  }
  return Array.from(set);
}
function lookupRouteTime(dayKey, type, place) {
  const dk = dayKeyNorm(dayKey);
  const tp = type === "dropoff" ? "dropoff" : "pickup";
  const pl = safeStr(place).trim();
  if (!pl) return "";
  const day = getRouteDay(dk);
  const arr = tp === "pickup" ? day.pickup : day.dropoff;
  const found = arr.find((s) => safeStr(s?.place).trim() === pl);
  return safeStr(found?.time).trim();
}

/* people */
const people = computed(() => (Array.isArray(store.state.public.people) ? store.state.public.people : []));
const peopleRows = computed(() => {
  const arr = [];
  for (const p of people.value) {
    const id = String(p?.id || "").trim();
    const name = safeStr(p?.name).trim();
    if (!id || !name) continue;
    const assign = p?.assign && typeof p.assign === "object" ? p.assign : {};
    arr.push({ id, name, assign });
  }
  arr.sort((a, b) => a.name.localeCompare(b.name, "ko"));
  return arr;
});
const selectedPersonName = computed(() => {
  if (!props.selectedPersonId) return "";
  const p = peopleRows.value.find((x) => String(x.id) === String(props.selectedPersonId));
  return safeStr(p?.name).trim();
});
const peopleRowsToShow = computed(() => {
  const pid = safeStr(props.selectedPersonId).trim();
  if (!pid) return peopleRows.value;
  return peopleRows.value.filter((p) => String(p.id) === String(pid));
});
const pickedPerson = computed(() => {
  const pid = safeStr(props.selectedPersonId).trim();
  if (!pid) return null;
  return people.value.find((x) => String(x?.id || "").trim() === pid) || null;
});

/** ✅ 여기만 수정: "즉시 Firestore 저장"은 store.scheduleSave()로 강제 flush */
async function tryPersistPublicImmediate() {
  try {
    if (typeof store.scheduleSave === "function") {
      await store.scheduleSave(); // ✅ public/admin flush (즉시 setDoc)
    }
  } catch (e) {}
}
async function commitReservationsImmediate() {
  await tryPersistPublicImmediate();
}

/* name edit */
const editName = ref("");
watch(
  () => props.selectedPersonId,
  () => {
    editName.value = selectedPersonName.value || "";
  },
  { immediate: true }
);
watch(
  () => selectedPersonName.value,
  (v) => {
    const cur = safeStr(editName.value).trim();
    const next = safeStr(v).trim();
    if (!cur || cur === next) editName.value = next;
  }
);
async function commitName() {
  const pid = safeStr(props.selectedPersonId).trim();
  if (!pid) return;

  const nextName = safeStr(editName.value).trim();
  if (!nextName) {
    editName.value = selectedPersonName.value || "";
    return;
  }

  const prevName = selectedPersonName.value || "";
  if (nextName === prevName) return;

  try {
    if (typeof store.updatePersonName === "function") {
      await store.updatePersonName(pid, nextName);
      await tryPersistPublicImmediate();
      return;
    }
    if (typeof store.upsertPerson === "function") {
      await store.upsertPerson({ id: pid, name: nextName });
      await tryPersistPublicImmediate();
      return;
    }
  } catch (e) {}

  const idx = people.value.findIndex((x) => String(x?.id || "").trim() === pid);
  if (idx >= 0) store.state.public.people[idx] = { ...store.state.public.people[idx], name: nextName };
  await tryPersistPublicImmediate();
}

/* assign */
function pickedAssign(dKeyRaw) {
  const dKey = dayKeyNorm(dKeyRaw);

  const a = pickedPerson.value?.assign?.[dKey];
  if (!a || typeof a !== "object") {
    return { pickupPlace: "", pickupTime: "", dropoffPlace: "", dropoffTime: "" };
  }
  return {
    pickupPlace: safeStr(a.pickupPlace).trim(),
    pickupTime: safeStr(a.pickupTime).trim(),
    dropoffPlace: safeStr(a.dropoffPlace).trim(),
    dropoffTime: safeStr(a.dropoffTime).trim(),
  };
}
async function onChangeAssignPlace(dayKeyRaw, type, nextPlaceRaw) {
  const pid = safeStr(props.selectedPersonId).trim();
  if (!pid) return;

  const dk = dayKeyNorm(dayKeyRaw);
  const tp = type === "dropoff" ? "dropoff" : "pickup";
  const nextPlace = safeStr(nextPlaceRaw).trim();
  const nextTime = nextPlace ? lookupRouteTime(dk, tp, nextPlace) : "";

  const currentAssign =
    pickedPerson.value?.assign && typeof pickedPerson.value.assign === "object" ? pickedPerson.value.assign : {};
  const dayObj = currentAssign[dk] && typeof currentAssign[dk] === "object" ? currentAssign[dk] : {};

  const patch = {
    ...currentAssign,
    [dk]: {
      ...dayObj,
      ...(tp === "pickup"
        ? { pickupPlace: nextPlace, pickupTime: nextTime }
        : { dropoffPlace: nextPlace, dropoffTime: nextTime }),
    },
  };

  try {
    if (typeof store.updatePersonAssign === "function") {
      await store.updatePersonAssign(pid, patch);
      await tryPersistPublicImmediate();
      return;
    }
    if (typeof store.upsertPerson === "function") {
      await store.upsertPerson({ id: pid, assign: patch });
      await tryPersistPublicImmediate();
      return;
    }
  } catch (e) {}

  const idx = people.value.findIndex((x) => String(x?.id || "").trim() === pid);
  if (idx >= 0) store.state.public.people[idx] = { ...store.state.public.people[idx], assign: patch };
  await tryPersistPublicImmediate();
}

/* reservations: 결석 완전 제외 */
const reservations = computed(() => (Array.isArray(store.state.public.reservations) ? store.state.public.reservations : []));
function isAbsentReservation(r) {
  const rr = safeStr(r?.reason).trim();
  const kk = safeStr(r?.kind).trim();
  return rr === "absent" || kk === "결석" || !!r?.absent;
}
const reservationsForDay = computed(() => {
  const iso = normIsoDate(resDateIso.value) || normIsoDate(activeYmd.value);
  if (!iso) return [];
  return reservations.value.filter((r) => normIsoDate(safeStr(r?.date)) === iso && !isAbsentReservation(r));
});
const reservationsForDayFiltered = computed(() => {
  const pid = safeStr(props.selectedPersonId).trim();
  if (!pid) return reservationsForDay.value;
  return reservationsForDay.value.filter((r) => safeStr(r?.personId).trim() === pid);
});

/* group read */
const reservationsByPersonFiltered = computed(() => {
  const map = {};
  for (const r of reservationsForDay.value) {
    const pid = safeStr(r?.personId).trim();
    if (!pid) continue;

    const kind = safeStr(r?.kind) || safeStr(r?.reason) || "예약";
    const type = safeStr(r?.type) || (safeStr(r?.pickupPlace) ? "pickup" : "dropoff");
    const time = safeStr(r?.time) || "—";
    const place =
      safeStr(r?.place) ||
      (type === "pickup" ? safeStr(r?.pickupPlace) : safeStr(r?.dropoffPlace)) ||
      "—";

    if (!map[pid]) map[pid] = [];
    map[pid].push({ kind, type, time, place });
  }
  return map;
});
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
function personNameById(pid) {
  const id = String(pid || "");
  const p = people.value.find((x) => String(x?.id || "") === id);
  return safeStr(p?.name).trim() || "(알 수 없음)";
}

/* normalize dual */
function normalizeReason(r) {
  const rr = safeStr(r?.reason).trim();
  if (rr === "supplement" || rr === "timeChange" || rr === "custom") return rr;
  const k = safeStr(r?.kind).trim();
  if (k === "시간변경") return "timeChange";
  if (k === "보강") return "supplement";
  if (k) return "custom";
  return "supplement";
}
function normalizeText(r) {
  return safeStr(r?.text).trim() || safeStr(r?.customText).trim() || "";
}
function normalizePickupPlace(r) {
  return safeStr(r?.pickupPlace).trim() || "";
}
function normalizeDropoffPlace(r) {
  return safeStr(r?.dropoffPlace).trim() || "";
}
function normalizePickupTime(r) {
  return safeStr(r?.pickupTime).trim() || "";
}
function normalizeDropoffTime(r) {
  return safeStr(r?.dropoffTime).trim() || "";
}

/* add dual */
const raReason = ref("supplement"); // supplement | timeChange | custom | absent
const raPickupPlace = ref("");
const raDropoffPlace = ref("");
const raPickupTime = ref("");
const raDropoffTime = ref("");
const raText = ref("");

const pickupPlaceOptions = computed(() => placeOptionsByDay(resDayKey.value, "pickup"));
const dropoffPlaceOptions = computed(() => placeOptionsByDay(resDayKey.value, "dropoff"));

function syncAddTimes() {
  raPickupTime.value = raPickupPlace.value ? lookupRouteTime(resDayKey.value, "pickup", raPickupPlace.value) : "";
  raDropoffTime.value = raDropoffPlace.value ? lookupRouteTime(resDayKey.value, "dropoff", raDropoffPlace.value) : "";
}

watch(
  () => raReason.value,
  () => {
    raPickupPlace.value = "";
    raDropoffPlace.value = "";
    raPickupTime.value = "";
    raDropoffTime.value = "";
    raText.value = "";
  }
);
watch(
  () => resDateIso.value,
  () => {
    raPickupPlace.value = "";
    raDropoffPlace.value = "";
    raPickupTime.value = "";
    raDropoffTime.value = "";
  }
);

function ensureReservationsArray() {
  if (!Array.isArray(store.state.public.reservations)) store.state.public.reservations = [];
}
function genResId() {
  const r = Math.random().toString(16).slice(2, 8);
  const t = Date.now().toString(36);
  return `res-${t}-${r}`;
}

async function addReservationDual() {
  const pid = safeStr(props.selectedPersonId).trim();
  const dateIso = normIsoDate(resDateIso.value);
  if (!pid || !dateIso) return;

  if (raReason.value === "absent") return;

  const puPlace = safeStr(raPickupPlace.value).trim();
  const doPlace = safeStr(raDropoffPlace.value).trim();
  if (!puPlace && !doPlace) return;

  const puTime = puPlace ? lookupRouteTime(resDayKey.value, "pickup", puPlace) : "";
  const doTime = doPlace ? lookupRouteTime(resDayKey.value, "dropoff", doPlace) : "";

  const labelMap = {
    supplement: "보강",
    timeChange: "시간변경",
    custom: "사용자 텍스트 저장",
  };

  ensureReservationsArray();
  store.state.public.reservations.push({
    id: genResId(),
    date: dateIso,
    personId: pid,
    reason: raReason.value,
    kind: labelMap[raReason.value] || "보강",
    pickupPlace: puPlace,
    pickupTime: puTime,
    dropoffPlace: doPlace,
    dropoffTime: doTime,
    text: raReason.value === "custom" ? safeStr(raText.value).trim() : "",
  });

  raPickupPlace.value = "";
  raDropoffPlace.value = "";
  raPickupTime.value = "";
  raDropoffTime.value = "";
  raText.value = "";

  await commitReservationsImmediate();
}

function findNthReservationIndexInStore(filteredIdx) {
  const pid = safeStr(props.selectedPersonId).trim();
  const dateIso = normIsoDate(resDateIso.value);
  if (!pid || !dateIso) return -1;

  let count = -1;
  for (let i = 0; i < reservations.value.length; i++) {
    const r = reservations.value[i];
    if (isAbsentReservation(r)) continue;
    if (normIsoDate(safeStr(r?.date)) !== dateIso) continue;
    if (safeStr(r?.personId).trim() !== pid) continue;
    count++;
    if (count === filteredIdx) return i;
  }
  return -1;
}

async function updateReservationDualField(filteredIdx, field, valRaw) {
  const realIdx = findNthReservationIndexInStore(filteredIdx);
  if (realIdx < 0) return;

  const cur = store.state.public.reservations[realIdx] || {};
  const key = String(field || "");

  if (key === "reason") {
    const next = valRaw === "timeChange" || valRaw === "custom" ? valRaw : "supplement";
    const labelMap = {
      supplement: "보강",
      timeChange: "시간변경",
      custom: "사용자 텍스트 저장",
    };

    store.state.public.reservations[realIdx] = {
      ...cur,
      reason: next,
      kind: labelMap[next] || "보강",
      text: next === "custom" ? normalizeText(cur) : "",
    };

    await commitReservationsImmediate();
    return;
  }

  if (key === "text") {
    store.state.public.reservations[realIdx] = { ...cur, text: safeStr(valRaw).trim() };
    return;
  }

  store.state.public.reservations[realIdx] = { ...cur, [key]: valRaw };
  await commitReservationsImmediate();
}

async function updateReservationDualPlace(filteredIdx, which, nextPlaceRaw) {
  const realIdx = findNthReservationIndexInStore(filteredIdx);
  if (realIdx < 0) return;

  const cur = store.state.public.reservations[realIdx] || {};
  const nextPlace = safeStr(nextPlaceRaw).trim();

  if (which === "pickup") {
    const t = nextPlace ? lookupRouteTime(resDayKey.value, "pickup", nextPlace) : "";
    store.state.public.reservations[realIdx] = { ...cur, pickupPlace: nextPlace, pickupTime: t };
  } else {
    const t = nextPlace ? lookupRouteTime(resDayKey.value, "dropoff", nextPlace) : "";
    store.state.public.reservations[realIdx] = { ...cur, dropoffPlace: nextPlace, dropoffTime: t };
  }

  await commitReservationsImmediate();
}

async function removeReservation(filteredIdx) {
  const realIdx = findNthReservationIndexInStore(filteredIdx);
  if (realIdx < 0) return;

  store.state.public.reservations.splice(realIdx, 1);
  await commitReservationsImmediate();
}
</script>

<style scoped>
*,
*::before,
*::after {
  box-sizing: border-box;
}

.card {
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  overflow: hidden;
}
.box {
  padding: 14px;
  max-width: 100%;
}

.minihelp {
  font-size: 12px;
  opacity: 0.7;
  line-height: 1.5;
  margin-top: 6px;
}
.minihelp2 {
  margin-top: 8px;
  font-size: 12px;
  opacity: 0.65;
  line-height: 1.5;
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
.sep2 {
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
  margin: 12px 0;
}
.emptymini {
  font-size: 12px;
  opacity: 0.55;
  padding: 10px 0 0;
}

/* 이름 */
.namebar {
  margin-bottom: 12px;
  max-width: 100%;
}
.nameinput {
  width: 100%;
  max-width: 100%;
  height: 44px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.14);
  color: inherit;
  padding: 0 12px;
  font-weight: 1000;
  font-size: 16px;
  outline: none;
}
.nameinput:focus {
  border-color: rgba(108, 255, 192, 0.22);
  box-shadow: 0 0 0 3px rgba(108, 255, 192, 0.08);
}

/* 요일 카드 */
.daylist {
  display: grid;
  gap: 10px;
  max-width: 100%;
}
.daycard {
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.1);
  padding: 10px;
  max-width: 100%;
  overflow: hidden;
}
.dayhead {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.daylabel {
  font-weight: 1000;
  opacity: 0.95;
}
.dayrows {
  display: grid;
  gap: 6px;
}
.drow {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  min-width: 0;
}
.chip {
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  white-space: nowrap;
}
.chip.k {
  font-weight: 1000;
  opacity: 0.9;
}
.time {
  font-size: 12px;
  opacity: 0.75;
  white-space: nowrap;
}

.placeSelect {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  height: 34px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(0, 0, 0, 0.55);
  color: rgba(255, 255, 255, 0.92);
  padding: 0 10px;
  font-weight: 1000;
  outline: none;
  color-scheme: dark;
}

/* grid(유지) */
.gridwrap {
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.1);
  overflow: auto;
}
.gridhead {
  display: grid;
  grid-template-columns: 120px repeat(5, minmax(190px, 1fr));
  gap: 0;
  padding: 10px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  position: sticky;
  top: 0;
  background: rgba(13, 18, 26, 0.92);
  backdrop-filter: blur(6px);
  z-index: 1;
}
.gridrow {
  display: grid;
  grid-template-columns: 120px repeat(5, minmax(190px, 1fr));
  padding: 10px 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}
.g-name {
  min-width: 0;
  padding-right: 10px;
}
.pname {
  font-weight: 1000;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.g-day {
  min-width: 0;
  padding: 0 8px;
}
.chipline {
  display: flex;
  gap: 6px;
  align-items: center;
  margin: 4px 0;
}
.chip.v {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 예약 */
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

.topbar {
  display: grid;
  gap: 10px;
  padding: 10px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.12);
}
.toprow {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.dateInp {
  height: 34px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(0, 0, 0, 0.55);
  color: rgba(255, 255, 255, 0.92);
  padding: 0 10px;
  outline: none;
  font-weight: 1000;
  color-scheme: dark;
}
.daypill {
  height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.10);
  background: rgba(255, 255, 255, 0.06);
  display: inline-flex;
  align-items: center;
  font-weight: 1000;
  white-space: nowrap;
}
.absentNote {
  font-size: 12px;
  opacity: 0.7;
  padding: 10px;
  border-radius: 16px;
  border: 1px dashed rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.03);
}

.resAddDual {
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.12);
  padding: 10px;
  overflow: hidden;
}
.dualrow {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 10px;
}
.dualrow.actions {
  grid-template-columns: 1fr;
  margin-bottom: 0;
  justify-items: end;
}
@media (max-width: 720px) {
  .dualrow {
    grid-template-columns: 1fr;
  }
}
.cell {
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.08);
  padding: 10px;
  overflow: hidden;
}
.cell.full {
  grid-column: 1 / -1;
}
.lab {
  font-size: 12px;
  font-weight: 1000;
  opacity: 0.9;
  margin-bottom: 8px;
}

.selDark,
.inpDark {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  height: 34px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(0, 0, 0, 0.55);
  color: rgba(255, 255, 255, 0.92);
  padding: 0 10px;
  outline: none;
  font-weight: 1000;
  color-scheme: dark;
}

.timePill {
  margin-top: 8px;
  height: 34px;
  padding: 0 12px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.10);
  background: rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 1000;
  font-size: 12px;
  white-space: nowrap;
}

.btnAdd,
.btnDel {
  min-width: 64px;
  height: 34px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.9);
  font-weight: 1000;
  cursor: pointer;
  white-space: nowrap;
}
.btnAdd:active,
.btnDel:active {
  transform: translateY(1px);
}

.resEditList {
  display: grid;
  gap: 10px;
}
.resEditRowDual {
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.12);
  padding: 10px;
  overflow: hidden;
}
.rowTop {
  display: flex;
  gap: 10px;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
</style>
