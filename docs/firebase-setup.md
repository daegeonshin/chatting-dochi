# 친구 서버(Firebase) 만들기

DG님 개인 구글 계정으로 한 번만 하면 됩니다. 무료(Spark) 플랜이라 결제 수단 등록이 필요 없습니다.

## 1. 프로젝트 만들기
1. https://console.firebase.google.com 에 개인 구글 계정으로 로그인합니다.
2. "프로젝트 만들기" → 이름 : chatting-dochi → Google 애널리틱스는 끕니다 → 만들기.

## 2. 익명 로그인 켜기
1. 왼쪽 메뉴 "보안" → "Authentication" → "시작하기".
2. "로그인 방법" 탭 → "익명" → 사용 설정 → 저장.
   (아이들은 이메일, 전화번호 없이 들어옵니다. 폰마다 보이지 않는 번호가 하나씩 생깁니다.)

## 3. 데이터베이스 만들기
1. 왼쪽 메뉴 "데이터베이스 및 스토리지" → "Realtime Database" → "데이터베이스 만들기". (Firestore 말고 Realtime Database)
2. 위치 : 싱가포르(asia-southeast1) → "잠금 모드로 시작" → 사용 설정.
3. "규칙" 탭 → 내용을 모두 지우고 forest-friends\database.rules.json 내용을 붙여 넣기 → "게시".

## 4. 웹 앱 등록
1. 왼쪽 메뉴 "설정"(톱니바퀴) → "프로젝트 설정" → "내 앱" → 웹 아이콘(</>).
2. 앱 닉네임 : chatting-dochi, "Firebase 호스팅"은 체크하지 않습니다 → 앱 등록.
3. 화면에 나오는 firebaseConfig 블록(apiKey, authDomain, databaseURL, projectId, appId)을 Claude에게 붙여 주시면 js\firebase-config.js에 넣습니다.
   databaseURL이 안 보이면 3단계를 끝낸 뒤 다시 열면 생깁니다.

## 5. (권장) 우리 사이트에서만 쓰게 막기
1. Authentication → "설정" → "승인된 도메인"에 daegeonshin.github.io 가 있는지 확인하고, 없으면 추가합니다.
2. https://console.cloud.google.com → 같은 프로젝트 → "API 및 서비스" → "사용자 인증 정보" → Browser key → "웹사이트" 제한 :
   https://daegeonshin.github.io/* , http://127.0.0.1:8765/*

## 알아 둘 점
- apiKey는 비밀번호가 아니라 프로젝트 이름표라서 공개 저장소에 올라가도 됩니다. 실제 보호는 보안 규칙이 합니다.
- 보안 규칙 요약 : 초대 코드를 아는 사람만 방에 들어가고, 방 안 사람만 채팅과 위치를 봅니다. 방 목록은 아무도 볼 수 없습니다. 방장만 내보내기와 잠그기를 할 수 있고, 내보낸 친구는 같은 폰으로 다시 못 들어옵니다.
- 무료 한도 : 동시 접속 100명, 저장 1GB, 다운로드 월 10GB. 친구 5명이 매일 놀아도 한참 남습니다.
- 사용량은 Realtime Database → "사용량" 탭에서 볼 수 있습니다.
