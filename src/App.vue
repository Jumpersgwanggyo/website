<template>
  <main class="page">
    <header class="top">
      <div class="brand">
        <div class="logo">J</div>
        <div class="brand-text">
          <h1 class="title">차량 시간표 관리</h1>
          <p class="sub">더미 데이터 · 로컬 저장 · 레이아웃 우선</p>
        </div>
      </div>

      <div class="right">
        <RouterLink class="nav-btn" to="/">홈</RouterLink>
        <RouterLink class="nav-btn" to="/settings">설정</RouterLink>
      </div>
    </header>

    <section class="content">
      <RouterView />
    </section>
  </main>
</template>

<script setup></script>

<style>
/* =========================
   ✅ Pretendard 전역 적용
   ========================= */
html,
body,
#app {
  height: 100%;
  width: 100%;
  margin: 0;
  font-family: "Pretendard", system-ui, -apple-system, Segoe UI, Roboto,
    "Noto Sans KR", sans-serif;
}

/* =========================
   Base
   ========================= */
body {
  background: #0b0f14;
  color: #e9eef5;
}

.page {
  min-height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
}

/* =========================
   Top Bar
   ========================= */
.top {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(13, 18, 26, 0.92);
  backdrop-filter: blur(8px);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  font-weight: 900;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.title {
  margin: 0;
  font-size: 16px;
  font-weight: 800; /* Pretendard 추천 헤더 굵기 */
}

.sub {
  margin: 3px 0 0;
  font-size: 12px;
  font-weight: 400;
  opacity: 0.75;
}

/* =========================
   Nav
   ========================= */
.right {
  display: flex;
  gap: 8px;
  align-items: center;
}

.nav-btn {
  text-decoration: none;
  color: inherit;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.04);
  font-weight: 600;
}

/* =========================
   Content
   ========================= */
.content {
  width: 100%;
  flex: 1;
  padding: 14px 16px;
  box-sizing: border-box;
}
</style>
