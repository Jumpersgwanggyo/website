// FILE: src/store/jumpersStore.js
// ✅ 싱글톤 store
// ✅ Firestore 3영역 분리(현재 rules에 맞춤)
//    - jumpers_app/default        : public (days/routes/people/reservations)
//    - jumpers_state/default      : done (doneMap)
//    - jumpers_templates/default  : admin (옵션)
// ✅ Home/Settings 모두 실시간 구독(구독은 전역 1회만)
// ✅ 완료 토글은 done 문서만 update → payload 작고 빠름
// ✅ (추가) public/admin 상태 변경 시 자동저장(디바운스 + 스냅샷 반영 제외)
// ✅ (추가) reservations:
//    - 당일 기준 과거 예약은 자동 삭제(필수)
//    - 예약이 있으면 차량목록(lines)에서 기본명단보다 우선 반영(이동/치환)
//    - "예약 카드" 추가가 아니라, 기존 routes 라인 내 names를 예약 기준으로 바꿈
//    - 표시: 이름(예약사유)
//    - 결석: 기본/예약 모두에서 완전 제외
// ✅ (중요 변경)
//    - routes가 있으면 무조건 routes로 로드 (days는 fallback만)
//
// ✅ (이번 수정 포인트)
//    - 차량목록: names가 0인 라인은 로드(표시)하지 않음
//
// ✅ (이번 수정)
//    - 테스트용 날짜 오프셋 제거: 오늘 기준(0일)로 복귀

import { computed, reactive, ref, watch } from "vue";
import { db } from "@/firebase";
import { doc, onSnapshot, setDoc, updateDoc, deleteField, serverTimestamp } from "firebase/firestore";

/** =========================
 *  Firestore Paths
 *  ========================= */
const PUBLIC_COL = "jumpers_app";
const PUBLIC_DOC = "default";

const DONE_COL = "jumpers_state";
const DONE_DOC = "default";

const ADMIN_COL = "jumpers_templates";
const ADMIN_DOC = "default";

/** =========================
 *  KST Utils
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
 *  Reservation Helpers
 *  ========================= */
function reasonLabel(r) {
  const rr = safeStr(r?.reason).trim();

  // ✅ 결석
  if (rr === "absent") return "결석";

  // ✅ 보강/시간변경
  if (rr === "supplement") return "보강";
  if (rr === "timeChange") return "시간변경";

  // ✅ 사용자 텍스트는 입력한 내용 그대로 라벨로
  if (rr === "custom") {
    const t =
      safeStr(r?.customText).trim() ||
      safeStr(r?.reasonText).trim() ||
      safeStr(r?.kindText).trim() ||
      safeStr(r?.kind).trim();
    return t || "사용자텍스트";
  }

  const k = safeStr(r?.kind).trim();
  if (k) return k;
  return "예약";
}

function isAbsentReservation(r) {
  const rr = safeStr(r?.reason).trim();
  const kk = safeStr(r?.kind).trim();
  return rr === "absent" || kk === "결석" || !!r?.absent;
}

function isPastYmd(ymd, todayYmd) {
  const a = safeStr(ymd).trim();
  const b = safeStr(todayYmd).trim();
  if (!a || !b) return false;
  return a < b;
}

function cleanupReservationsInState(state, today) {
  const list = safeArr(state.public.reservations);
  const next = list.filter((r) => {
    const d = safeStr(r?.date).trim();
    if (!d) return false;
    if (isPastYmd(d, today)) return false;
    return true;
  });

  if (next.length !== list.length) {
    state.public.reservations = next;
    return true;
  }
  return false;
}

/** =========================
 *  (A) days 구조 (fallback만)
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
    const kind = safeStr(it?.kind).trim();
    const names = splitNames(it?.names);
    const { time, place } = parseDaysPlace(it?.place);

    if (!id) continue;
    if (kind !== "pickup" && kind !== "dropoff") continue;
    if (!place) continue;
    if (names.length === 0) continue; // ✅ names 없으면 로드X

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
 *  (B) routes 기반 라인 + 예약 우선 반영
 *  ========================= */
function buildRosterMaps(people, dayKey, type) {
  const outByPlace = new Map();
  const baseByPerson = new Map();

  const placeField = type === "dropoff" ? "dropoffPlace" : "pickupPlace";

  for (const p of safeArr(people)) {
    const pid = safeStr(p?.id).trim();
    const name = safeStr(p?.name).trim();
    if (!pid || !name) continue;

    const assign = p?.assign && typeof p.assign === "object" ? p.assign : {};
    const day = assign?.[dayKey] || {};
    const place = safeStr(day?.[placeField]).trim();
    if (!place) continue;

    baseByPerson.set(pid, { name, place });

    if (!outByPlace.has(place)) outByPlace.set(place, []);
    outByPlace.get(place).push(name);
  }

  return { outByPlace, baseByPerson };
}

function removeNameFromPlace(map, place, name) {
  if (!place || !name) return;
  const arr = map.get(place);
  if (!arr || !arr.length) return;
  const next = arr.filter((x) => x !== name);
  if (next.length) map.set(place, next);
  else map.delete(place);
}
function addNameToPlace(map, place, name) {
  if (!place || !name) return;
  if (!map.has(place)) map.set(place, []);
  map.get(place).push(name);
}

function reservationDisplayName(r, peopleById) {
  const label = reasonLabel(r);

  const kind = safeStr(r?.kind);
  if (kind === "체험") {
    const nm = safeStr(r?.tempName).trim();
    return nm ? `${nm}(${label})` : "";
  }

  const pid = safeStr(r?.personId).trim();
  if (!pid) return "";
  const p = peopleById.get(pid);
  const nm = safeStr(p?.name).trim();
  if (!nm) return "";
  return `${nm}(${label})`;
}

function buildFinalNamesByPlaceFromReservations(reservations, ymd, dk, people) {
  const { outByPlace: basePickupByPlace, baseByPerson: basePickupByPerson } = buildRosterMaps(
    people,
    dk,
    "pickup"
  );
  const { outByPlace: baseDropoffByPlace, baseByPerson: baseDropoffByPerson } = buildRosterMaps(
    people,
    dk,
    "dropoff"
  );

  const finalPickup = new Map();
  const finalDropoff = new Map();
  for (const [k, v] of basePickupByPlace.entries()) finalPickup.set(k, [...v]);
  for (const [k, v] of baseDropoffByPlace.entries()) finalDropoff.set(k, [...v]);

  const peopleById = new Map();
  for (const p of safeArr(people)) peopleById.set(String(p?.id || ""), p);

  for (const r of safeArr(reservations)) {
    if (safeStr(r?.date) !== ymd) continue;
    if (!dk) continue;

    const pid = safeStr(r?.personId).trim();

    if (isAbsentReservation(r)) {
      if (!pid) continue;

      const puBase = basePickupByPerson.get(pid);
      if (puBase?.place) removeNameFromPlace(finalPickup, puBase.place, puBase.name);

      const doBase = baseDropoffByPerson.get(pid);
      if (doBase?.place) removeNameFromPlace(finalDropoff, doBase.place, doBase.name);

      continue;
    }

    const displayNm = reservationDisplayName(r, peopleById);
    if (!displayNm) continue;

    const pu = safeStr(r?.pickupPlace).trim();
    const dof = safeStr(r?.dropoffPlace).trim();

    if (pu) {
      if (pid) {
        const base = basePickupByPerson.get(pid);
        if (base?.place) removeNameFromPlace(finalPickup, base.place, base.name);
      }
      addNameToPlace(finalPickup, pu, displayNm);
    }

    if (dof) {
      if (pid) {
        const base = baseDropoffByPerson.get(pid);
        if (base?.place) removeNameFromPlace(finalDropoff, base.place, base.name);
      }
      addNameToPlace(finalDropoff, dof, displayNm);
    }
  }

  return { finalPickup, finalDropoff };
}

function buildLinesFromRoutes(routesForDay, people, reservations, ymd, dk, doneMap) {
  const { finalPickup, finalDropoff } = buildFinalNamesByPlaceFromReservations(reservations, ymd, dk, people);

  // ✅ 수정: names가 0이면 라인을 로드/표시하지 않음
  const pickup = safeArr(routesForDay?.pickup)
    .map((s) => {
      const stopId = safeStr(s?.id);
      const time = safeStr(s?.time);
      const place = safeStr(s?.place).trim();
      if (!stopId || !place) return null;

      const key = makeLineKey("pickup", dk, stopId);
      const names = finalPickup.get(place) || [];
      if (!names.length) return null; // ✅ 핵심

      return {
        lineKey: key,
        type: "pickup",
        time,
        place,
        names,
        done: !!doneMap?.[key],
        hasReservation: false,
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
      const names = finalDropoff.get(place) || [];
      if (!names.length) return null; // ✅ 핵심

      return {
        lineKey: key,
        type: "dropoff",
        time,
        place,
        names,
        done: !!doneMap?.[key],
        hasReservation: false,
      };
    })
    .filter(Boolean)
    .sort((a, b) => String(a.time || "").localeCompare(String(b.time || "")));

  return { pickup, dropoff };
}

function hasAnyRoutes(routes) {
  const r = routes && typeof routes === "object" ? routes : null;
  if (!r) return false;
  for (const dk of ["mon", "tue", "wed", "thu", "fri"]) {
    const day = r?.[dk];
    const pu = Array.isArray(day?.pickup) ? day.pickup.length : 0;
    const dof = Array.isArray(day?.dropoff) ? day.dropoff.length : 0;
    if (pu + dof > 0) return true;
  }
  return false;
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

    done: { doneMap: {} },

    admin: { ui: {} },
  });

  /** Auto-save */
  const applyingPublic = ref(false);
  const applyingAdmin = ref(false);

  let publicSaveTimer = null;
  let adminSaveTimer = null;

  const AUTO_SAVE_MS = 450;

  async function flushPublicSave() {
    if (applyingPublic.value) return;
    if (state.loadingPublic) return;

    const refPublic = doc(db, PUBLIC_COL, PUBLIC_DOC);
    const payload = {
      days: state.public.days,
      routes: state.public.routes,
      people: state.public.people,
      reservations: state.public.reservations,
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(refPublic, payload, { merge: true });
    } catch (e) {
      console.error("[Firestore] public auto-save error:", e);
    }
  }

  async function flushAdminSave() {
    if (applyingAdmin.value) return;
    if (state.loadingAdmin) return;

    const refAdmin = doc(db, ADMIN_COL, ADMIN_DOC);
    const payload = {
      ui: state.admin.ui,
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(refAdmin, payload, { merge: true });
    } catch (e) {
      console.error("[Firestore] admin auto-save error:", e);
    }
  }

  function schedulePublicSave() {
    if (publicSaveTimer) clearTimeout(publicSaveTimer);
    publicSaveTimer = setTimeout(() => {
      publicSaveTimer = null;
      flushPublicSave();
    }, AUTO_SAVE_MS);
  }

  function scheduleAdminSave() {
    if (adminSaveTimer) clearTimeout(adminSaveTimer);
    adminSaveTimer = setTimeout(() => {
      adminSaveTimer = null;
      flushAdminSave();
    }, AUTO_SAVE_MS);
  }

  async function scheduleSave() {
    if (publicSaveTimer) clearTimeout(publicSaveTimer);
    if (adminSaveTimer) clearTimeout(adminSaveTimer);
    publicSaveTimer = null;
    adminSaveTimer = null;
    await Promise.all([flushPublicSave(), flushAdminSave()]);
  }

  /** ✅ (추가) people 빠른추가 */
  function genPersonId() {
    return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  async function addPersonQuick(nameRaw) {
    const nm = safeStr(nameRaw).trim().replace(/\s+/g, " ");
    if (!nm) return "";

    if (state.loadingPublic) return "";
    if (applyingPublic.value) return "";

    const existing = safeArr(state.public.people).find((p) => safeStr(p?.name).trim() === nm);
    if (existing?.id) return safeStr(existing.id);

    const id = genPersonId();
    const nextPeople = [...safeArr(state.public.people), { id, name: nm, assign: {} }];
    state.public.people = nextPeople;
    schedulePublicSave();
    return id;
  }

  /** ✅ (추가) reservations 추가/삭제 */
  function genReservationId() {
    return `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function normalizeReasonToCode(reasonTypeRaw) {
    const t = safeStr(reasonTypeRaw).trim();
    if (t === "보강") return "supplement";
    if (t === "시간변경") return "timeChange";
    if (t === "사용자텍스트지정") return "custom";
    if (t === "결석") return "absent";
    return "";
  }

  function addReservation(payloadRaw) {
    if (state.loadingPublic) return "";
    if (applyingPublic.value) return "";

    const payload = payloadRaw && typeof payloadRaw === "object" ? payloadRaw : {};
    const date = safeStr(payload.date).trim();
    if (!date) return "";

    if (isPastYmd(date, todayYmd.value)) return "";

    const id = genReservationId();

    const reasonType = safeStr(payload.reasonType).trim();
    const reasonText = safeStr(payload.reasonText).trim();

    const isTrial = reasonType === "체험";
    const isAbsent = reasonType === "결석";

    const personId = isTrial ? "" : safeStr(payload.personId).trim();
    const tempName = isTrial ? safeStr(payload.tempName).trim() : "";

    const pu = payload.pickup && typeof payload.pickup === "object" ? payload.pickup : null;
    const dof = payload.dropoff && typeof payload.dropoff === "object" ? payload.dropoff : null;

    const pickupPlace = safeStr(pu?.place).trim();
    const dropoffPlace = safeStr(dof?.place).trim();

    const next = {
      id,
      date,

      kind: isTrial ? "체험" : isAbsent ? "결석" : "",
      reason: normalizeReasonToCode(reasonType),
      kindText: reasonType,

      personId,
      tempName,

      pickupPlace,
      dropoffPlace,

      pickupTime: safeStr(pu?.time).trim(),
      dropoffTime: safeStr(dof?.time).trim(),

      customText: reasonType === "사용자텍스트지정" ? reasonText : "",

      createdAt: Date.now(),
    };

    if (isAbsent && !personId) return "";
    if (!isAbsent && !pickupPlace && !dropoffPlace) return "";

    state.public.reservations = [...safeArr(state.public.reservations), next];
    schedulePublicSave();

    return id;
  }

  function deleteReservation(reservationIdRaw) {
    const rid = safeStr(reservationIdRaw).trim();
    if (!rid) return false;
    if (state.loadingPublic) return false;
    if (applyingPublic.value) return false;

    const list = safeArr(state.public.reservations);
    const next = list.filter((r) => safeStr(r?.id).trim() !== rid);
    if (next.length === list.length) return false;

    state.public.reservations = next;
    schedulePublicSave();
    return true;
  }

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

  /** Home 기준 */
  // ✅ 테스트용(1) -> 표준: 오늘(0)
  const homeOffsetDays = ref(0);

  const homeDate = computed(() => addKstDays(kstNow.value, homeOffsetDays.value));
  const todayKey = computed(() => kstDayKey(homeDate.value));
  const todayYmd = computed(() => kstYmd(homeDate.value));

  watch(
    () => todayYmd.value,
    (newYmd, oldYmd) => {
      if (!newYmd || newYmd === oldYmd) return;
      if (state.loadingPublic) return;
      if (applyingPublic.value) return;

      const changed = cleanupReservationsInState(state, newYmd);
      if (changed) schedulePublicSave();
    }
  );

  /** subscribe */
  let unsubPublic = null;
  let unsubDone = null;
  let unsubAdmin = null;
  let inited = false;

  function subscribeAll() {
    if (inited) return;
    inited = true;

    state.loadingPublic = true;
    state.errorPublic = "";
    const refPublic = doc(db, PUBLIC_COL, PUBLIC_DOC);

    unsubPublic = onSnapshot(
      refPublic,
      (snap) => {
        state.loadingPublic = false;
        if (!snap.exists()) return;
        const data = snap.data() || {};

        applyingPublic.value = true;

        if (data.days && typeof data.days === "object") state.public.days = data.days;
        if (data.routes && typeof data.routes === "object") state.public.routes = data.routes;

        state.public.people = Array.isArray(data.people) ? data.people : [];
        state.public.reservations = Array.isArray(data.reservations) ? data.reservations : [];

        setTimeout(() => {
          applyingPublic.value = false;

          const changed = cleanupReservationsInState(state, todayYmd.value);
          if (changed) schedulePublicSave();
        }, 0);
      },
      (err) => {
        state.loadingPublic = false;
        state.errorPublic = err?.message || String(err);
        console.error("[Firestore] public subscribe error:", err);
      }
    );

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
        state.done.doneMap = data.doneMap && typeof data.doneMap === "object" ? data.doneMap : {};
      },
      (err) => {
        state.loadingDone = false;
        state.errorDone = err?.message || String(err);
        console.error("[Firestore] done subscribe error:", err);
      }
    );

    state.loadingAdmin = true;
    state.errorAdmin = "";
    const refAdmin = doc(db, ADMIN_COL, ADMIN_DOC);

    unsubAdmin = onSnapshot(
      refAdmin,
      (snap) => {
        state.loadingAdmin = false;
        if (!snap.exists()) return;
        const data = snap.data() || {};

        applyingAdmin.value = true;
        state.admin.ui = data.ui && typeof data.ui === "object" ? data.ui : {};
        setTimeout(() => {
          applyingAdmin.value = false;
        }, 0);
      },
      (err) => {
        state.loadingAdmin = false;
        state.errorAdmin = err?.message || String(err);
        console.error("[Firestore] admin subscribe error:", err);
      }
    );

    startAutoSaveWatches();
  }

  let autoSaveWatchesStarted = false;
  function startAutoSaveWatches() {
    if (autoSaveWatchesStarted) return;
    autoSaveWatchesStarted = true;

    watch(
      () => state.public,
      () => {
        if (applyingPublic.value) return;
        schedulePublicSave();
      },
      { deep: true }
    );

    watch(
      () => state.admin.ui,
      () => {
        if (applyingAdmin.value) return;
        scheduleAdminSave();
      },
      { deep: true }
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

  /** lines */
  function linesByDay(dk, ymdOverride = "") {
    const dkSafe = String(dk || "");
    if (!dkSafe) return { pickup: [], dropoff: [] };

    const ymd = ymdOverride || todayYmd.value;
    const doneMap = state.done.doneMap || {};

    if (hasAnyRoutes(state.public.routes)) {
      const routesForDay = state.public.routes?.[dkSafe] || { pickup: [], dropoff: [] };
      return buildLinesFromRoutes(routesForDay, state.public.people, state.public.reservations, ymd, dkSafe, doneMap);
    }

    const daysArr = state.public.days?.[dkSafe];
    if (Array.isArray(daysArr) && daysArr.length) {
      return buildLinesFromDaysArray(daysArr, dkSafe, doneMap);
    }

    return { pickup: [], dropoff: [] };
  }

  const todayLines = computed(() => {
    const dk = todayKey.value;
    if (!dk) return { pickup: [], dropoff: [] };
    return linesByDay(dk, todayYmd.value);
  });

  /** done toggle */
  async function toggleDone(lineKey) {
    const k = String(lineKey || "");
    if (!k) return;

    const refDone = doc(db, DONE_COL, DONE_DOC);
    const fieldPath = `doneMap.${k}`;
    const isDone = !!state.done.doneMap?.[k];

    try {
      if (isDone) {
        await updateDoc(refDone, { [fieldPath]: deleteField(), updatedAt: serverTimestamp() });
      } else {
        await setDoc(refDone, { doneMap: { [k]: Date.now() }, updatedAt: serverTimestamp() }, { merge: true });
      }
    } catch (e) {
      console.error("[Firestore] toggleDone error:", e);
    }
  }

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

    scheduleSave,

    // ✅ export
    addPersonQuick,

    // ✅ reservation API
    addReservation,
    deleteReservation,
  };

  return _store;
}
