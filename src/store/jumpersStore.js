// FILE: src/store/jumpersStore.js
// ✅ Pinia 없이 동작 (싱글톤)
// ✅ Firestore: jumpers_app/default
// ✅ Firestore 데이터 구조 2가지 모두 지원
//    1) days.{mon|tue|...} = [{id,kind,names,place}, ...]
//    2) routes/people/reservations = (예전 구조)
// ✅ 완료(done)는 Firestore doneMap + localStorage fallback

import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { db } from "@/firebase";
import {
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteField,
} from "firebase/firestore";

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
 *  Done(localStorage) fallback
 *  ========================= */
function loadDoneMapLocal() {
  try {
    const raw = localStorage.getItem("jumpers_done_map_v1");
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}
function saveDoneMapLocal(doneMap) {
  try {
    localStorage.setItem("jumpers_done_map_v1", JSON.stringify(doneMap || {}));
  } catch {}
}
function makeLineKey(type, dayKey, stopId) {
  return `${type}:${dayKey}:${String(stopId || "")}`;
}

/** =========================
 *  (A) days 구조 파싱
 *  ========================= */
function parseDaysPlace(placeRaw) {
  const s = safeStr(placeRaw).trim();
  if (!s) return { time: "", place: "" };

  const m = s.match(/^(\d{1,2}:\d{2})\s*\[(.+?)\]\s*$/);
  if (m) {
    const time = m[1];
    const place = m[2];
    return { time, place };
  }

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
    if (names.length === 0) continue;

    const key = makeLineKey(kind, dk, id);

    out.push({
      lineKey: key,
      type: kind,
      time,
      place,
      names,
      done: !!doneMap?.[key],
      hasReservation: false,
    });
  }

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
  const out = new Map();
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
  const outPickup = new Map();
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

      if (!names || names.length === 0) return null;

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

      if (!names || names.length === 0) return null;

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
      ui: { activeTab: "all" },
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
      // ✅ Firestore에 저장될 doneMap (없으면 빈 객체)
      doneMap: {},
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

  // ✅ Home 기준 (테스트용: 내일)
  const homeOffsetDays = ref(1);
  const homeDate = computed(() => addKstDays(kstNow.value, homeOffsetDays.value));

  // doneMap: Firestore 우선, 없으면 localStorage fallback
  const doneMapLocal = ref(loadDoneMapLocal());
  const doneMap = computed(() => {
    const remote = state.data.doneMap;
    if (remote && typeof remote === "object" && Object.keys(remote).length) return remote;
    return doneMapLocal.value || {};
  });

  function saveDoneMapLocalIfNeeded(next) {
    doneMapLocal.value = next || {};
    saveDoneMapLocal(doneMapLocal.value);
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

        if (data.days && typeof data.days === "object") state.data.days = data.days;
        if (data.routes && typeof data.routes === "object") state.data.routes = data.routes;

        state.data.people = Array.isArray(data.people) ? data.people : [];
        state.data.reservations = Array.isArray(data.reservations) ? data.reservations : [];

        // ✅ doneMap도 실시간으로 받기
        state.data.doneMap = data.doneMap && typeof data.doneMap === "object" ? data.doneMap : {};
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

  // ✅ Home 기준 키/날짜
  const todayKey = computed(() => kstDayKey(homeDate.value));
  const todayYmd = computed(() => kstYmd(homeDate.value));

  // ✅ 공통: 특정 요일 라인 생성 (설정에서 사용)
  function linesByDay(dk) {
    if (!dk) return { pickup: [], dropoff: [] };

    const daysArr = state.data.days?.[dk];
    if (Array.isArray(daysArr) && daysArr.length) {
      return buildLinesFromDaysArray(daysArr, dk, doneMap.value);
    }

    // fallback: routes 구조
    const ymd = todayYmd.value; // (routes/예약 구조는 date가 필요해서, 테스트는 home 기준 date를 씀)
    const routesForDay = state.data.routes?.[dk] || { pickup: [], dropoff: [] };
    return buildLinesFromRoutes(routesForDay, state.data.people, state.data.reservations, ymd, dk, doneMap.value);
  }

  // ✅ Home용 todayLines
  const todayLines = computed(() => {
    const dk = todayKey.value;
    if (!dk) return { pickup: [], dropoff: [] };
    return linesByDay(dk);
  });

  // ✅ 핵심: 완료 토글을 Firestore로 저장 (설정/홈 동기화)
  async function toggleDone(lineKey) {
    const k = String(lineKey || "");
    if (!k) return;

    const refDoc = doc(db, APP_COL, APP_DOC);
    const fieldPath = `doneMap.${k}`;

    const isDone = !!state.data.doneMap?.[k];

    try {
      // doneMap이 아직 문서에 없을 수도 있으니 setDoc(merge)로 안전하게 만들고 update도 가능
      if (isDone) {
        await updateDoc(refDoc, { [fieldPath]: deleteField() });
      } else {
        await setDoc(refDoc, { doneMap: { [k]: Date.now() } }, { merge: true });
      }
    } catch (e) {
      // Firestore 실패 시 최소한 로컬로라도 동작 (디버그/오프라인 대비)
      const local = { ...(doneMapLocal.value || {}) };
      if (local[k]) delete local[k];
      else local[k] = Date.now();
      saveDoneMapLocalIfNeeded(local);

      console.error("[Firestore] toggleDone error:", e);
    }
  }

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

    startClock,
    stopClock,

    // 홈 기준
    homeOffsetDays,
    homeDate,
    todayKey,
    todayYmd,
    todayLines,

    // 설정용
    linesByDay,

    // 완료
    toggleDone,

    // 구독
    subscribeApp,
    unsubscribeApp,
  };

  return _store;
}
