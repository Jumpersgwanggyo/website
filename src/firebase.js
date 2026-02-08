// FILE: src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA2PwpvEvWIaOqc-QgPwCEQAJWIssLHEvY",
  authDomain: "jumpers-bea06.firebaseapp.com",
  projectId: "jumpers-bea06",
  storageBucket: "jumpers-bea06.firebasestorage.app",
  messagingSenderId: "874804375064",
  appId: "1:874804375064:web:ed1927c9ed89debdfd9d6d",
  measurementId: "G-B2R4P6T3YW",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// (선택) 오프라인 캐시/동기화. GH Pages 같은 환경에서도 대체로 잘 동작.
// 동시 탭/브라우저 정책에 따라 실패할 수 있으니 조용히 무시 처리.
enableIndexedDbPersistence(db).catch(() => {});
