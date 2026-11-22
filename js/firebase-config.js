// Firebase 연결 정보 (docs/firebase-setup.md 순서대로 만든 프로젝트)
// apiKey는 비밀번호가 아니라 프로젝트 이름표라서 공개 저장소에 올려도 됩니다.
// 실제 보호는 database.rules.json(보안 규칙)과 익명 로그인이 합니다.
// null로 바꾸면 친구 기능이 꺼지고 혼자 놀기만 됩니다.
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCcBQIhfyxebDFh91v8srz6wqK2AlJfU_M',
  authDomain: 'chatting-dochi.firebaseapp.com',
  databaseURL: 'https://chatting-dochi-default-rtdb.firebaseio.com',
  projectId: 'chatting-dochi',
  appId: '1:122964608975:web:f7938c2b74f719fd3134ba',
};
