<template>
  <section class="layout">
    <header class="head">
      <div>
        <h2 class="h2">설정(레이아웃 먼저)</h2>
        <p class="hint">DB 로드는 아직 안 함 · 더미 데이터로 “홈 동작”만 확인</p>
      </div>

      <div class="actions">
        <button class="btn" @click="store.scheduleSave()">로컬 저장</button>
        <button class="btn danger" @click="store.resetToDummy()">더미로 초기화</button>
      </div>
    </header>

    <div class="cols">
      <section class="card">
        <div class="card-title">기본노선(요약)</div>
        <div class="box">
          <div class="kv">
            <div class="k">오늘 요일</div>
            <div class="v">{{ store.todayKey.value }}</div>
          </div>
          <div class="kv">
            <div class="k">승차 라인</div>
            <div class="v">{{ pickupCount }}</div>
          </div>
          <div class="kv">
            <div class="k">하차 라인</div>
            <div class="v">{{ dropoffCount }}</div>
          </div>

          <p class="note">
            다음 단계: 여기에서 “기본노선 편집 UI” 붙일 거야.
          </p>
        </div>
      </section>

      <section class="card">
        <div class="card-title">명단(요약)</div>
        <div class="box">
          <div class="kv">
            <div class="k">사람 수</div>
            <div class="v">{{ peopleCount }}</div>
          </div>
          <div class="kv">
            <div class="k">원칙</div>
            <div class="v">예약이 있으면 기본 명단 무시</div>
          </div>

          <p class="note">
            다음 단계: “이름 기준으로 요일별 승/하차 장소 지정” UI.
          </p>
        </div>
      </section>

      <section class="card">
        <div class="card-title">예약(테스트)</div>
        <div class="box">
          <div class="kv">
            <div class="k">오늘 예약</div>
            <div class="v">{{ todayResCount }}</div>
          </div>

          <div class="minihelp">
            아래 폼으로 예약 추가하면, 홈에서 “예약 태그 + 명단 덮어쓰기”가 보여야 함.
          </div>

          <div class="sep"></div>

          <h3 class="h3">오늘 예약 추가</h3>
          <form class="form" @submit.prevent="submit">
            <div class="row2">
              <div class="row">
                <label>구분</label>
                <select v-model="f.type" class="inp">
                  <option value="pickup">승차</option>
                  <option value="dropoff">하차</option>
                </select>
              </div>
              <div class="row">
                <label>시간</label>
                <input v-model="f.time" class="inp" placeholder="14:05" />
              </div>
            </div>

            <div class="row">
              <label>장소</label>
              <input v-model="f.place" class="inp" placeholder="2부 더샵" />
            </div>

            <div class="row">
              <label>이름(쉼표)</label>
              <input v-model="f.names" class="inp" placeholder="(체험) 홍길동, 김철수" />
            </div>

            <div class="row2">
              <div class="row">
                <label>사유</label>
                <select v-model="f.reason" class="inp">
                  <option value="보강">보강</option>
                  <option value="체험">체험</option>
                  <option value="사용자지정">사용자지정</option>
                </select>
              </div>
              <div class="row" v-if="f.reason === '사용자지정'">
                <label>직접 입력</label>
                <input v-model="f.reasonCustom" class="inp" placeholder="사유 입력" />
              </div>
            </div>

            <button class="btn primary full" type="submit">추가</button>
          </form>
        </div>
      </section>
    </div>
  </section>
</template>

<script setup>
import { computed, reactive } from "vue";
import { useAppStore } from "@/store/jumpersStore";

const store = useAppStore();

const pickupCount = computed(() => (store.state.data.routes?.[store.todayKey.value]?.pickup || []).length);
const dropoffCount = computed(() => (store.state.data.routes?.[store.todayKey.value]?.dropoff || []).length);
const peopleCount = computed(() => (store.state.data.people || []).length);
const todayResCount = computed(() =>
  (store.state.data.reservations || []).filter((r) => r.date === store.todayYmd.value).length
);

const f = reactive({
  type: "pickup",
  time: "",
  place: "",
  names: "",
  reason: "보강",
  reasonCustom: "",
});

function submit() {
  const time = (f.time || "").trim();
  const place = (f.place || "").trim();
  const rawNames = (f.names || "").trim();
  if (!time || !place || !rawNames) return;

  const names = rawNames.split(",").map((s) => s.trim()).filter(Boolean);
  const reason = f.reason === "사용자지정" ? (f.reasonCustom || "").trim() : f.reason;

  store.addReservation({
    date: store.todayYmd.value,
    type: f.type,
    time,
    place,
    names,
    reason: reason || "사용자지정",
  });

  f.time = "";
  f.place = "";
  f.names = "";
  f.reasonCustom = "";
}
</script>

<style scoped>
.layout{ display:grid; gap: 12px; }

.head{
  display:flex;
  align-items:flex-end;
  justify-content:space-between;
  gap: 12px;
}
.h2{ margin:0; font-size: 18px; font-weight: 1000; }
.h3{ margin: 0 0 10px; font-size: 14px; font-weight: 1000; }
.hint{ margin: 6px 0 0; opacity: 0.65; font-size: 12px; }

.actions{ display:flex; gap: 8px; }
.btn{
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.14);
  background: rgba(255,255,255,0.04);
  color: inherit;
  font-weight: 1000;
  cursor:pointer;
}
.btn.primary{ background: rgba(255,255,255,0.14); }
.btn.danger{ border-color: rgba(255,120,120,0.30); background: rgba(255,120,120,0.10); }

.cols{ display:grid; gap: 12px; }

.card{
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(255,255,255,0.04);
  overflow:hidden;
}
.card-title{
  padding: 12px 14px;
  font-weight: 1000;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.box{ padding: 14px; }

.kv{
  display:flex;
  justify-content:space-between;
  gap: 10px;
  padding: 10px 0;
  border-top: 1px solid rgba(255,255,255,0.06);
}
.kv:first-of-type{ border-top: 0; }
.kv .k{ opacity: 0.7; font-weight: 900; }
.kv .v{ font-weight: 1000; }

.note{ margin: 12px 0 0; font-size: 12px; opacity: 0.65; line-height: 1.5; }

.minihelp{
  font-size: 12px;
  opacity: 0.7;
  line-height: 1.5;
  margin-top: 6px;
}

.sep{
  height: 1px;
  background: rgba(255,255,255,0.08);
  margin: 14px 0;
}

.form{ display:grid; gap: 10px; margin-top: 10px; }
.row{ display:grid; gap: 6px; }
.row2{ display:grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.row label{ font-size: 12px; opacity: 0.7; font-weight: 900; }

.inp{
  width: 100%;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.14);
  background: rgba(255,255,255,0.04);
  color: inherit;
  outline: none;
}

.full{ width: 100%; }

@media (min-width: 1100px) {
  .cols{ grid-template-columns: 1fr 1fr 1fr; align-items: start; }
}
</style>
