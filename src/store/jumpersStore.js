// FILE: src/store/jumpersStore.js
// ✅ Pinia 없이 동작 (싱글톤)
// ✅ Firestore: jumpers_app/default
// ✅ Firestore 데이터 구조 2가지 모두 지원
//    1) days.{mon|tue|...} = [{id,kind,names,place}, ...]
//    2) routes/people/reservations = (예전 구조)
// ✅ 완료(done)는 localStorage로만 저장(우선)

import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { db } from "@/firebase";
import { doc, onSnapshot } from "firebase/firestore";

/** ✅ RULES 허용 경로 */
const APP_COL = "jumpers_app";
const APP_DOC = "default";

/** =========================
 *  KST Utils (안정)
 *  ========================= */
function nowKstDate() {
  const ms = Date.now() + 9 * 60 * 60 * 1000;
  const d = new Date(ms);
  return new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      d.getUTCHours(),
      d.getUTCMinutes(),
      d.getUTCSeconds()
    )
  );
}
function addKstDays(base, addDays) {
  const d = base instanceof Date ? base : nowKstDate();
  const n = Number(addDays || 0);
  return new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate() + n,
      d.getUTCHours(),
      d.getUTCMinutes(),
      d.getUTCSeconds()
    )
  );
}
function kstYmd(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function kstDayKey(d) {
  const w = d.getUTCDay();
  const map = { 1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri" };
  return map[w] || "";
}
function safeArr(v) {
  return Array.isArray(v) ? v : [];
}
function safeStr(v) {
  return typeof v === "string" ? v : "";
}
function splitNames(v) {
  const s = safeStr(v).trim();
  if (!s) return [];
  return s
    .split(",")
    .map((x) => String(x || "").trim())
    .filter(Boolean);
}

/** =========================
 *  Done(localStorage)
 *  ========================= */
function loadDoneMap() {
  try {
    const raw = localStorage.getItem("jumpers_done_map_v1");
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}
function saveDoneMap(doneMap) {
  try {
    localStorage.setItem("jumpers_done_map_v1", JSON.stringify(doneMap || {}));
  } catch {}
}
function makeLineKey(type, dayKey, stopId) {
  return `${type}:${dayKey}:${String(stopId || "")}`;
}

/** =========================
 *  (A) days 구조 파싱
 *  place 예시:
 *   - "14:00 [호반정문]" -> time="14:00", place="호반정문"
 *   - "[1부 하차/레이크시티]" -> time="—", place="[1부 하차/레이크시티]" (그대로)
 *  ========================= */
function parseDaysPlace(placeRaw) {
  const s = safeStr(placeRaw).trim();
  if (!s) return { time: "", place: "" };

  // "14:00 [호반정문]"
  const m = s.match(/^(\d{1,2}:\d{2})\s*\[(.+?)\]\s*$/);
  if (m) {
    const time = m[1];
    const place = m[2];
    return { time, place };
  }

  // 그 외는 시간 없음으로 처리
  return { time: "—", place: s };
}

function buildLinesFromDaysArray(dayArr, dk, doneMap) {
  const out = [];
  for (const it of safeArr(dayArr)) {
    const id = safeStr(it?.id).trim();
    const kind = safeStr(it?.kind).trim(); // "pickup" | "dropoff"
    const names = splitNames(it?.names);
    const { time, place } = parseDaysPlace(it?.place);

    if (!id) continue;
    if (kind !== "pickup" && kind !== "dropoff") continue;
    if (!place) continue;
    if (names.length === 0) continue; // ✅ 명단 없는 시간 제외

    const key = makeLineKey(kind, dk, id);

    out.push({
      lineKey: key,
      type: kind, // Home은 type을 사용
      time,
      place,
      names,
      done: !!doneMap?.[key],
      hasReservation: false, // days구조에서는 구분 불가(일단 false)
    });
  }

  // 시간 정렬: "—"는 뒤로
  out.sort((a, b) => {
    const at = a.time === "—" ? "99:99" : a.time || "99:99";
    const bt = b.time === "—" ? "99:99" : b.time || "99:99";
    return String(at).localeCompare(String(bt));
  });

  return {
    pickup: out.filter((x) => x.type === "pickup"),
    dropoff: out.filter((x) => x.type === "dropoff"),
  };
}

/** =========================
 *  (B) routes/people/reservations 구조 (기존)
 *  ========================= */
function buildNamesByPlaceFromRoster(people, dayKey, type) {
  const out = new Map(); // place -> names[]
  const placeField = type === "dropoff" ? "dropoffPlace" : "pickupPlace";

  for (const p of safeArr(people)) {
    const name = safeStr(p?.name).trim();
    if (!name) continue;
    const assign = p?.assign && typeof p.assign === "object" ? p.assign : {};
    const day = assign?.[dayKey] || {};
    const place = safeStr(day?.[placeField]).trim();
    if (!place) continue;

    if (!out.has(place)) out.set(place, []);
    out.get(place).push(name);
  }
  return out;
}

function reservationDisplayName(r, peopleById) {
  const kind = safeStr(r?.kind);
  if (kind === "체험") {
    const nm = safeStr(r?.tempName).trim();
    return nm ? nm : "";
  }
  const pid = safeStr(r?.personId).trim();
  if (!pid) return "";
  const p = peopleById.get(pid);
  return safeStr(p?.name).trim();
}

function buildOverrideByPlaceFromReservations(reservations, todayYmd, dayKey, people) {
  const outPickup = new Map(); // place -> names[]
  const outDropoff = new Map();

  const peopleById = new Map();
  for (const p of safeArr(people)) peopleById.set(String(p?.id || ""), p);

  for (const r of safeArr(reservations)) {
    if (safeStr(r?.date) !== todayYmd) continue;
    const kind = safeStr(r?.kind);
    if (kind === "결석") continue;
    if (!dayKey) continue;

    const nm = reservationDisplayName(r, peopleById);
    if (!nm) continue;

    const pu = safeStr(r?.pickupPlace).trim();
    const dof = safeStr(r?.dropoffPlace).trim();

    if (pu) {
      if (!outPickup.has(pu)) outPickup.set(pu, []);
      outPickup.get(pu).push(nm);
    }
    if (dof) {
      if (!outDropoff.has(dof)) outDropoff.set(dof, []);
      outDropoff.get(dof).push(nm);
    }
  }

  return { outPickup, outDropoff };
}

function buildLinesFromRoutes(routesForDay, people, reservations, ymd, dk, doneMap) {
  const rosterPickup = buildNamesByPlaceFromRoster(people, dk, "pickup");
  const rosterDropoff = buildNamesByPlaceFromRoster(people, dk, "dropoff");
  const { outPickup, outDropoff } = buildOverrideByPlaceFromReservations(reservations, ymd, dk, people);

  const pickup = safeArr(routesForDay?.pickup)
    .map((s) => {
      const stopId = safeStr(s?.id);
      const time = safeStr(s?.time);
      const place = safeStr(s?.place).trim();
      if (!stopId || !place) return null;

      const key = makeLineKey("pickup", dk, stopId);
      const overrideNames = outPickup.get(place);
      const baseNames = rosterPickup.get(place) || [];
      const names = overrideNames ? overrideNames : baseNames;

      if (!names || names.length === 0) return null; // ✅ 명단 없는 시간 제외

      return {
        lineKey: key,
        type: "pickup",
        time,
        place,
        names,
        done: !!doneMap?.[key],
        hasReservation: !!overrideNames,
      };
    })
    .filter(Boolean)
    .sort((a, b) => String(a.time || "").localeCompare(String(b.time || "")));

  const dropoff = safeArr(routesForDay?.dropoff)
    .map((s) => {
      const stopId = safeStr(s?.id);
      const time = safeStr(s?.time);
      const place = safeStr(s?.place).trim();
      if (!stopId || !place) return null;

      const key = makeLineKey("dropoff", dk, stopId);
      const overrideNames = outDropoff.get(place);
      const baseNames = rosterDropoff.get(place) || [];
      const names = overrideNames ? overrideNames : baseNames;

      if (!names || names.length === 0) return null; // ✅ 명단 없는 시간 제외

      return {
        lineKey: key,
        type: "dropoff",
        time,
        place,
        names,
        done: !!doneMap?.[key],
        hasReservation: !!overrideNames,
      };
    })
    .filter(Boolean)
    .sort((a, b) => String(a.time || "").localeCompare(String(b.time || "")));

  return { pickup, dropoff };
}

/** =========================
 *  Singleton store
 *  ========================= */
let _store = null;

export function useAppStore() {
  if (_store) return _store;

  const state = reactive({
    loading: true,
    error: "",
    data: {
      ui: { activeTab: "all" }, // all | pickup | dropoff
      // ✅ 두 구조 모두 저장 가능
      days: { mon: [], tue: [], wed: [], thu: [], fri: [] },
      routes: {
        mon: { pickup: [], dropoff: [] },
        tue: { pickup: [], dropoff: [] },
        wed: { pickup: [], dropoff: [] },
        thu: { pickup: [], dropoff: [] },
        fri: { pickup: [], dropoff: [] },
      },
      people: [],
      reservations: [],
    },
  });

  // clock
  const kstNow = ref(nowKstDate());
  let clockTimer = null;

  function startClock() {
    if (clockTimer) return;
    clockTimer = setInterval(() => {
      kstNow.value = nowKstDate();
    }, 1000);
  }
  function stopClock() {
    if (clockTimer) clearInterval(clockTimer);
    clockTimer = null;
  }

  // ✅ 임시: Home은 "내일" 기준으로 로드 (0=오늘, 1=내일)
  // 필요 없어지면 0으로 바꾸면 됨.
  const homeOffsetDays = ref(1);
  const homeDate = computed(() => addKstDays(kstNow.value, homeOffsetDays.value));

  // done(local)
  const doneMap = ref(loadDoneMap());
  function toggleDone(lineKey) {
    const k = String(lineKey || "");
    if (!k) return;
    if (doneMap.value?.[k]) delete doneMap.value[k];
    else doneMap.value[k] = Date.now();
    saveDoneMap(doneMap.value);
  }

  // firestore realtime
  let unsub = null;

  function subscribeApp() {
    if (unsub) return;

    state.loading = true;
    state.error = "";

    const refDoc = doc(db, APP_COL, APP_DOC);

    unsub = onSnapshot(
      refDoc,
      (snap) => {
        state.loading = false;
        if (!snap.exists()) return;

        const data = snap.data() || {};

        // ✅ 현재 Firestore 구조: days
        if (data.days && typeof data.days === "object") {
          state.data.days = data.days;
        }

        // ✅ 예전 구조도 같이 유지
        if (data.routes && typeof data.routes === "object") {
          state.data.routes = data.routes;
        }
        state.data.people = Array.isArray(data.people) ? data.people : [];
        state.data.reservations = Array.isArray(data.reservations) ? data.reservations : [];
      },
      (err) => {
        state.loading = false;
        state.error = err?.message || String(err);
        console.error("[Firestore] subscribeApp error:", err);
      }
    );
  }

  function unsubscribeApp() {
    if (unsub) unsub();
    unsub = null;
  }

  // ✅ Home 기준 키/날짜 (내일)
  const todayKey = computed(() => kstDayKey(homeDate.value));
  const todayYmd = computed(() => kstYmd(homeDate.value));

  // ✅ Home이 쓰는 todayLines: {pickup:[], dropoff:[]}
  const todayLines = computed(() => {
    const dk = todayKey.value;
    const ymd = todayYmd.value;
    if (!dk) return { pickup: [], dropoff: [] };

    // 1) days 구조가 있으면 그걸 우선 사용
    const daysArr = state.data.days?.[dk];
    if (Array.isArray(daysArr) && daysArr.length) {
      return buildLinesFromDaysArray(daysArr, dk, doneMap.value);
    }

    // 2) fallback: routes/people/reservations 조합
    const routesForDay = state.data.routes?.[dk] || { pickup: [], dropoff: [] };
    return buildLinesFromRoutes(routesForDay, state.data.people, state.data.reservations, ymd, dk, doneMap.value);
  });

  onMounted(() => {
    startClock();
    subscribeApp();
  });

  onBeforeUnmount(() => {
    stopClock();
    unsubscribeApp();
  });

  _store = {
    state,
    kstNow,

    // ✅ 홈 기준(내일)
    homeOffsetDays,
    homeDate,

    todayKey,
    todayYmd,
    todayLines,

    toggleDone,
    subscribeApp,
    unsubscribeApp,
  };

  return _store;
}
