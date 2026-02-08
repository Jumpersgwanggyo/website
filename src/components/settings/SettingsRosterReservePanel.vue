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
               선택된 사람: 이름 + 삭제 + 요일별 장소/시간
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
              <button class="btndelperson" type="button" @click="removeSelectedPerson">삭제</button>
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

          <!-- ✅ 하단 "예약 현황" 영역은 완전 제거 -->
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

const emit = defineEmits(["deleted-person"]);

const store = useAppStore();

const isLoading = computed(() => !!(store.state.loadingPublic || store.state.loadingDone));
const loadError = computed(() => store.state.errorPublic || store.state.errorDone || "");
const activeYmd = computed(() => store.todayYmd?.value || "");

function safeStr(v) {
  return typeof v === "string" ? v : "";
}

/** ✅ 요일 key를 mon~fri로 강제 정규화 */
function dayKeyNorm(raw) {
  const s = safeStr(raw).trim().toLowerCase();
  if (!s) return "mon";
  if (s === "mon" || s === "tue" || s === "wed" || s === "thu" || s === "fri") return s;

  const map = { "월": "mon", "화": "tue", "수": "wed", "목": "thu", "금": "fri" };
  const k = safeStr(raw).trim();
  if (map[k]) return map[k];
  return "mon";
}

const tab = ref("roster");

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

/** 즉시 저장 */
async function tryPersistPublicImmediate() {
  try {
    if (typeof store.scheduleSave === "function") {
      await store.scheduleSave();
    }
  } catch (e) {}
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

/* ✅ 삭제 */
async function removeSelectedPerson() {
  const pid = safeStr(props.selectedPersonId).trim();
  if (!pid) return;

  // people에서 삭제
  const idx = store.state.public.people.findIndex((p) => String(p?.id || "").trim() === pid);
  if (idx >= 0) store.state.public.people.splice(idx, 1);

  // 혹시 reservations가 남아있으면 같이 정리(데이터 찌꺼기 방지)
  if (Array.isArray(store.state.public.reservations)) {
    store.state.public.reservations = store.state.public.reservations.filter(
      (r) => safeStr(r?.personId).trim() !== pid
    );
  }

  await tryPersistPublicImmediate();

  editName.value = "";
  emit("deleted-person", { personId: pid });
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

/* 이름 + 삭제 */
.namebar {
  margin-bottom: 12px;
  max-width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
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
.btndelperson {
  height: 44px;
  padding: 0 14px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 120, 120, 0.10);
  color: rgba(255, 255, 255, 0.9);
  font-weight: 1000;
  cursor: pointer;
  white-space: nowrap;
}
.btndelperson:active {
  transform: translateY(1px);
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
</style>
