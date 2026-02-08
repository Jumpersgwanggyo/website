// FILE: src/store/jumpersStore.js
// ✅ 싱글톤 store
// ✅ Firestore 3영역 분리(현재 rules에 맞춤)
//    - jumpers_app/default        : public (days/routes/people/reservations)
//    - jumpers_state/default      : done (doneMap)
//    - jumpers_templates/default  : admin (옵션)
// ✅ Home/Settings 모두 실시간 구독(구독은 전역 1회만)
// ✅ 완료 토글은 done 문서만 update → payload 작고 빠름

import { computed, reactive, ref } from "vue";
import { db } from "@/firebase";
import {
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteField,
  serverTimestamp,
} from "firebase/firestore";

/** =========================
 *  Firestore Paths (rules에 맞춘 기존 구조)
 *  ========================= */
const PUBLIC_COL = "jumpers_app";
const PUBLIC_DOC = "default";

const DONE_COL = "jumpers_state";
const DONE_DOC = "default";

const ADMIN_COL = "jumpers_templates";
const ADMIN_DOC = "default";

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
function makeLineKey(type, dayKey, stopId) {
  return `${type}:${dayKey}:${String(stopId || "")}`;
}

/** =========================
 *  (A) days 구조 파싱
 *  place 예시:
 *   - "14:00 [호반정문]" -> time="14:00", place="호반정문"
 *   - "[1부 하차/레이크시티]" -> time="—", place=원문
 *  ========================= */
function parseDaysPlace(placeRaw) {
  const s = safeStr(placeRaw).trim();
  if (!s) return { time: "", place: "" };

  const m = s.match(/^(\d{1,2}:\d{2})\s*\[(.+?)\]\s*$/);
  if (m) return { time: m[1], place: m[2] };

  return { time: "—", place: s };
}

function buildLinesFromDaysArray(dayArr, dk, doneMap) {
  const out = [];
  for (const it of safeArr(dayArr)) {
    const id = safeStr(it?.id).trim();
    const kind = safeStr(it?.kind).trim(); // pickup | dropoff
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
      hasReservation: false, // days 구조는 예약 구분 정보가 없어서 우선 false
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
 *  (B) routes/people/reservations (기존)
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

function buildOverrideByPlaceFromReservations(reservations, ymd, dk, people) {
  const outPickup = new Map();
  const outDropoff = new Map();

  const peopleById = new Map();
  for (const p of safeArr(people)) peopleById.set(String(p?.id || ""), p);

  for (const r of safeArr(reservations)) {
    if (safeStr(r?.date) !== ymd) continue;
    const kind = safeStr(r?.kind);
    if (kind === "결석") continue;
    if (!dk) continue;

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
  const { outPickup, outDropoff } = buildOverrideByPlaceFromReservations(
    reservations,
    ymd,
    dk,
    people
  );

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
    loadingPublic: true,
    loadingDone: true,
    loadingAdmin: true,
    errorPublic: "",
    errorDone: "",
    errorAdmin: "",

    public: {
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

    done: {
      doneMap: {}, // { [lineKey]: ts }
    },

    admin: {
      ui: {},
    },
  });

  /** clock */
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

  /** Home 기준 (테스트: 월요일 땡기기 유지) */
  const homeOffsetDays = ref(1);
  const homeDate = computed(() => addKstDays(kstNow.value, homeOffsetDays.value));
  const todayKey = computed(() => kstDayKey(homeDate.value));
  const todayYmd = computed(() => kstYmd(homeDate.value));

  /** 구독(전역 1회) */
  let unsubPublic = null;
  let unsubDone = null;
  let unsubAdmin = null;
  let inited = false;

  function subscribeAll() {
    if (inited) return;
    inited = true;

    // 1) public: jumpers_app/default
    state.loadingPublic = true;
    state.errorPublic = "";
    const refPublic = doc(db, PUBLIC_COL, PUBLIC_DOC);

    unsubPublic = onSnapshot(
      refPublic,
      (snap) => {
        state.loadingPublic = false;
        if (!snap.exists()) return;
        const data = snap.data() || {};

        // days 우선
        if (data.days && typeof data.days === "object") state.public.days = data.days;
        if (data.routes && typeof data.routes === "object") state.public.routes = data.routes;

        state.public.people = Array.isArray(data.people) ? data.people : [];
        state.public.reservations = Array.isArray(data.reservations) ? data.reservations : [];
      },
      (err) => {
        state.loadingPublic = false;
        state.errorPublic = err?.message || String(err);
        console.error("[Firestore] public subscribe error:", err);
      }
    );

    // 2) done: jumpers_state/default
    state.loadingDone = true;
    state.errorDone = "";
    const refDone = doc(db, DONE_COL, DONE_DOC);

    unsubDone = onSnapshot(
      refDone,
      (snap) => {
        state.loadingDone = false;
        if (!snap.exists()) {
          state.done.doneMap = {};
          return;
        }
        const data = snap.data() || {};
        state.done.doneMap =
          data.doneMap && typeof data.doneMap === "object" ? data.doneMap : {};
      },
      (err) => {
        state.loadingDone = false;
        state.errorDone = err?.message || String(err);
        console.error("[Firestore] done subscribe error:", err);
      }
    );

    // 3) admin: jumpers_templates/default (옵션)
    state.loadingAdmin = true;
    state.errorAdmin = "";
    const refAdmin = doc(db, ADMIN_COL, ADMIN_DOC);

    unsubAdmin = onSnapshot(
      refAdmin,
      (snap) => {
        state.loadingAdmin = false;
        if (!snap.exists()) return;
        const data = snap.data() || {};
        state.admin.ui = data.ui && typeof data.ui === "object" ? data.ui : {};
      },
      (err) => {
        state.loadingAdmin = false;
        state.errorAdmin = err?.message || String(err);
        console.error("[Firestore] admin subscribe error:", err);
      }
    );
  }

  function unsubscribeAll() {
    if (unsubPublic) unsubPublic();
    if (unsubDone) unsubDone();
    if (unsubAdmin) unsubAdmin();
    unsubPublic = null;
    unsubDone = null;
    unsubAdmin = null;
    inited = false;
  }

  /** 라인 빌드(홈/설정 공용)
   *  - ymdOverride: routes 구조에서 reservation 덮어쓰기 판단에 사용
   */
  function linesByDay(dk, ymdOverride = "") {
    const dkSafe = String(dk || "");
    if (!dkSafe) return { pickup: [], dropoff: [] };

    const ymd = ymdOverride || todayYmd.value;
    const doneMap = state.done.doneMap || {};

    // 1) days 우선
    const daysArr = state.public.days?.[dkSafe];
    if (Array.isArray(daysArr) && daysArr.length) {
      return buildLinesFromDaysArray(daysArr, dkSafe, doneMap);
    }

    // 2) fallback routes
    const routesForDay = state.public.routes?.[dkSafe] || { pickup: [], dropoff: [] };
    return buildLinesFromRoutes(
      routesForDay,
      state.public.people,
      state.public.reservations,
      ymd,
      dkSafe,
      doneMap
    );
  }

  const todayLines = computed(() => {
    const dk = todayKey.value;
    if (!dk) return { pickup: [], dropoff: [] };
    return linesByDay(dk, todayYmd.value);
  });

  /** 완료 토글: jumpers_state/default doneMap만 업데이트 */
  async function toggleDone(lineKey) {
    const k = String(lineKey || "");
    if (!k) return;

    const refDone = doc(db, DONE_COL, DONE_DOC);
    const fieldPath = `doneMap.${k}`;
    const isDone = !!state.done.doneMap?.[k];

    try {
      if (isDone) {
        await updateDoc(refDone, {
          [fieldPath]: deleteField(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(
          refDone,
          { doneMap: { [k]: Date.now() }, updatedAt: serverTimestamp() },
          { merge: true }
        );
      }
    } catch (e) {
      console.error("[Firestore] toggleDone error:", e);
    }
  }

  /** 앱 시작용 init (App.vue에서 1회 호출) */
  function init() {
    startClock();
    subscribeAll();
  }

  _store = {
    state,
    kstNow,

    startClock,
    stopClock,

    init,
    subscribeAll,
    unsubscribeAll,

    homeOffsetDays,
    homeDate,

    todayKey,
    todayYmd,
    todayLines,

    linesByDay,

    toggleDone,
  };

  return _store;
}
