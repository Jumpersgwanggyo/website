<!-- FILE: src/components/settings/SettingsBaseRosterListPanel.vue -->
<template>
  <div class="box">
    <div class="minihelp" v-if="isLoading">데이터 로드 중…</div>
    <div class="minihelp" v-else-if="loadError">로드 오류: {{ loadError }}</div>

    <template v-else>
      <div class="subhead">명단</div>
      <div class="minihelp">이름 검색 → 아래에 이름만 나열 (자음/모음도 매칭)</div>

      <!-- 검색 -->
      <div class="searchbar">
        <input
          class="search"
          type="text"
          v-model="q"
          placeholder="이름 검색… (예: 김, ㄱㅈ, ㅅㅇ, ㅣ 등)"
          autocomplete="off"
        />
        <button v-if="q" class="clear" type="button" @click="q = ''">지우기</button>
      </div>

      <!-- 이름 리스트 (이름만) -->
      <div class="subgroup">
        <div class="subtag pickup">이름 목록</div>

        <div class="list">
          <!-- ✅ div 유지(스타일 유지) + 클릭/키보드 선택 -->
          <div
            v-for="name in filteredNames"
            :key="'nm-' + name"
            class="rowitem onecol clickable"
            role="button"
            tabindex="0"
            @click="selectByName(name)"
            @keydown.enter.prevent="selectByName(name)"
            @keydown.space.prevent="selectByName(name)"
          >
            <div class="nm">{{ name }}</div>
          </div>

          <div v-if="filteredNames.length === 0" class="emptymini">표시할 이름 없음</div>
        </div>
      </div>

      <p class="note">이름 클릭 시 오른쪽 예약현황이 해당 사람으로 필터됩니다.</p>
    </template>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { useAppStore } from "@/store/jumpersStore";

const props = defineProps({
  dayTab: { type: String, required: true }, // mon~fri
});

/** ✅ 부모로 선택 전달 */
const emit = defineEmits(["select-person"]);

const store = useAppStore();

const isLoading = computed(() => !!(store.state.loadingPublic || store.state.loadingDone));
const loadError = computed(() => store.state.errorPublic || store.state.errorDone || "");

/** ✅ people */
function safeStr(v) {
  return typeof v === "string" ? v : "";
}
const people = computed(() =>
  Array.isArray(store.state.public.people) ? store.state.public.people : []
);

/** ✅ 이름 목록(표시용) */
const allNames = computed(() => {
  const set = new Set();
  for (const p of people.value) {
    const name = safeStr(p?.name).trim();
    if (!name) continue;
    set.add(name);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "ko"));
});

/** ✅ name -> personId 매핑 (동명이인이면 첫 번째 id 사용) */
const nameToId = computed(() => {
  const map = new Map();
  for (const p of people.value) {
    const id = safeStr(p?.id).trim();
    const name = safeStr(p?.name).trim();
    if (!id || !name) continue;
    if (!map.has(name)) map.set(name, id);
  }
  return map;
});

const q = ref("");

// ----- 한글 자모/초성 매칭 -----
const CHO = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
const JUNG = ["ㅏ","ㅐ","ㅑ","ㅒ","ㅓ","ㅔ","ㅕ","ㅖ","ㅗ","ㅘ","ㅙ","ㅚ","ㅛ","ㅜ","ㅝ","ㅞ","ㅟ","ㅠ","ㅡ","ㅢ","ㅣ"];
const JONG = ["","ㄱ","ㄲ","ㄳ","ㄴ","ㄵ","ㄶ","ㄷ","ㄹ","ㄺ","ㄻ","ㄼ","ㄽ","ㄾ","ㄿ","ㅀ","ㅁ","ㅂ","ㅄ","ㅅ","ㅆ","ㅇ","ㅈ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];

const JAMO_SET = new Set([
  ...CHO,
  ...JUNG,
  ...JONG.filter(Boolean),
  "ㄳ","ㄵ","ㄶ","ㄺ","ㄻ","ㄼ","ㄽ","ㄾ","ㄿ","ㅀ","ㅄ",
  "ㅘ","ㅙ","ㅚ","ㅝ","ㅞ","ㅟ","ㅢ",
]);

function isHangulSyllable(ch) {
  const code = ch.charCodeAt(0);
  return code >= 0xac00 && code <= 0xd7a3;
}

function decomposeSyllable(ch) {
  const code = ch.charCodeAt(0) - 0xac00;
  const cho = Math.floor(code / 588);
  const jung = Math.floor((code % 588) / 28);
  const jong = code % 28;
  return { cho: CHO[cho], jung: JUNG[jung], jong: JONG[jong] };
}

function toInitials(str) {
  let out = "";
  for (const ch of str) out += isHangulSyllable(ch) ? decomposeSyllable(ch).cho : ch;
  return out;
}

function toJamo(str) {
  let out = "";
  for (const ch of str) {
    if (isHangulSyllable(ch)) {
      const d = decomposeSyllable(ch);
      out += d.cho + d.jung + (d.jong || "");
    } else out += ch;
  }
  return out;
}

function isOnlyJamo(str) {
  if (!str) return false;
  for (const ch of str) {
    if (ch === " " || ch === "\t" || ch === "\n") continue;
    if (!JAMO_SET.has(ch)) return false;
  }
  return true;
}

function matchesName(name, rawQuery) {
  const n = safeStr(name).trim();
  const qq = safeStr(rawQuery).trim();
  if (!qq) return true;

  const n0 = n.replace(/\s+/g, "");
  const q0 = qq.replace(/\s+/g, "");
  if (n0.includes(q0)) return true;

  if (isOnlyJamo(q0)) {
    const initials = toInitials(n0);
    const jamo = toJamo(n0);
    return initials.includes(q0) || jamo.includes(q0);
  }

  const qJamo = toJamo(q0);
  const nJamo = toJamo(n0);
  return nJamo.includes(qJamo);
}

const filteredNames = computed(() => {
  return allNames.value.filter((nm) => matchesName(nm, q.value));
});

/** ✅ 클릭 시 personId emit */
function selectByName(name) {
  const nm = safeStr(name).trim();
  if (!nm) return;

  const pid = nameToId.value.get(nm) || "";
  if (!pid) return;

  emit("select-person", { personId: pid, name: nm });
}
</script>

<style scoped>
.box,
.box * {
  box-sizing: border-box;
}

.box {
  padding: 14px;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
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

.subhead {
  font-size: 12px;
  font-weight: 1000;
  letter-spacing: 0.4px;
  opacity: 0.9;
  margin: 2px 0 10px;
}
.subgroup {
  margin-bottom: 14px;
}

.searchbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  margin: 10px 0 14px;
}

.search {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  height: 40px;
  border-radius: 12px;
  padding: 0 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.14);
  color: inherit;
  outline: none;
}
.search:focus {
  border-color: rgba(255, 255, 255, 0.22);
}

.clear {
  height: 40px;
  max-width: 100%;
  white-space: nowrap;
  padding: 0 12px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
  color: inherit;
  font-weight: 900;
  cursor: pointer;
}
.clear:active {
  transform: translateY(1px);
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

.list {
  display: grid;
  gap: 8px;
}
.rowitem {
  display: grid;
  gap: 10px;
  align-items: center;
  padding: 10px 10px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.12);
  width: 100%;
  max-width: 100%;
  min-width: 0;
}
.rowitem.onecol {
  grid-template-columns: 1fr;
}
.rowitem .nm {
  font-weight: 1000;
}
.emptymini {
  font-size: 12px;
  opacity: 0.55;
  padding: 10px 0 0;
}

/* ✅ 스타일 깨짐 없이 클릭감만 */
.clickable {
  cursor: pointer;
  user-select: none;
}
.clickable:hover {
  border-color: rgba(255, 255, 255, 0.14);
  background: rgba(0, 0, 0, 0.16);
}
.clickable:active {
  transform: translateY(1px);
}
</style>
