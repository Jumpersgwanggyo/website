import { createRouter, createWebHashHistory } from "vue-router";
import Home from "@/pages/Home.vue";
import Settings from "@/pages/Settings.vue";

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", component: Home },
    { path: "/settings", component: Settings },
  ],
});
