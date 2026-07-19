# 👜 PocketBon

> PWA for personal use (개인용 웹앱)

주머니 속에 담긴 나만의 앱 모음 — 설치 없이 브라우저에서 바로 사용하는 개인용 PWA입니다.

---

## ✨ 기능 목록

### 🧮 계산기
- 사칙연산, 퍼센트, 부호 변환
- 숫자 자동 콤마 표시 (1,000 / 2,309,000)
- = 누른 후 계산식 표시

### 🌤️ 날씨
- 도시 이름으로 실시간 날씨 조회
- 기온, 체감온도, 습도, 풍속 표시
- Open-Meteo 무료 API 사용 (키 불필요)

### ⏰ 알람
- 시간 설정 및 알람 이름 지정
- 켜기/끄기 토글
- 알람 울릴 때 소리 + 화면 팝업
- Firebase FCM 연동 (백그라운드 알림)

### ⏱️ 타이머 / 스톱워치
- 카운트다운 타이머
- 스톱워치

### 📝 메모
- 빠른 메모 작성 및 저장

### 💰 가계부
- 수입 / 지출 기록 및 잔액 계산
- 6자리 PIN 잠금 (설정 탭에서 설정)

### 📅 달력 & 일정
- 월별 달력 보기 (이전/다음 달 이동)
- 날짜 클릭 → 일정 등록 (제목, 시간, 색상)
- 달력에 색깔 점으로 일정 표시
- 공휴일 자동 표시 (한국천문연구원 API)
- 대체공휴일 포함

### 🗺️ 길찾기
- 도보 / 자동차 / 대중교통 통합 경로 탐색
- 실시간 내 위치 추적 (GPS, 이동 시 자동 업데이트)
- 지도에 경로선 표시 (수단별 색상 구분)
- 소요시간, 거리, 통행료 안내
- 대중교통: 버스+지하철 환승 경로 상세 안내 (ODsay API)
- 탐색 시 이전 결과 자동 초기화
- 카카오맵 JavaScript SDK + 카카오 모빌리티 REST API

### 🗂️ 탭 관리 (설정)
- 설정에서 탭 on/off 선택
- 많이 사용한 탭 순서대로 자동 정렬
- 아이콘만 표시 (글자 없음)

---

## 🛠️ 기술 스택

| 항목 | 내용 |
|------|------|
| 프론트엔드 | HTML, CSS, Vanilla JS |
| PWA | Service Worker, Web App Manifest |
| 날씨 API | Open-Meteo (무료, 키 불필요) |
| 공휴일 API | 한국천문연구원 특일정보 (공공데이터포털) |
| 지도/길찾기 | 카카오맵 JavaScript SDK + 카카오 모빌리티 REST API |
| 대중교통 경로 | ODsay API |
| 푸시 알림 | Firebase Cloud Messaging (FCM) |
| 배포 | Vercel |

---

## 📱 설치 방법 (홈 화면에 추가)

1. 크롬(Android) 또는 사파리(iOS)로 접속
2. 브라우저 메뉴 → **홈 화면에 추가**
3. 아이콘 생성 → 앱처럼 실행 🎉

---

## 🔑 API 키 발급 및 설정

### 1. 공휴일 API (한국천문연구원)

**발급 경로:**
1. [data.go.kr](https://www.data.go.kr) 접속 → 로그인
2. 검색창에 `한국천문연구원 특일 정보` 검색
3. `한국천문연구원_특일 정보` → 활용신청 (자동승인)
4. 마이페이지 → 개발계정 → 일반 인증키 복사

**코드 적용 위치 (`index.html`):**
```js
const HOLIDAY_API_KEY = '여기에_API키_입력';
```

---

### 2. 카카오맵 API

**발급 경로:**
1. [developers.kakao.com](https://developers.kakao.com) 접속 → 카카오 계정 로그인
2. 상단 **내 애플리케이션** → **애플리케이션 추가하기**
3. 앱 이름 입력 → 카테고리: `생산성/도구` → 저장
4. 생성된 앱 클릭 → 왼쪽 메뉴 **앱 → 플랫폼 키** 클릭
5. **JavaScript 키** 및 **REST API 키** 복사
6. 같은 페이지 **JavaScript SDK 도메인** 입력창에 `https://pocketbon.vercel.app` 입력 후 **+** → **저장**
7. 왼쪽 메뉴 **제품 설정 → 카카오맵** → 사용 상태 **ON**

**키 종류:**
| 키 이름 | 용도 |
|---------|------|
| **JavaScript 키** | 카카오맵 지도 표시 (SDK) |
| **REST API 키** | 자동차 경로 탐색 (카카오 모빌리티) |

**코드 적용 위치 (`index.html`):**
```js
// 카카오맵 SDK (JavaScript 키)
<script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=여기에_JS키_입력&libraries=services,clusterer"></script>

// 자동차 경로 탐색 (REST API 키)
const KAKAO_REST_KEY = '여기에_REST_API키_입력';
```

---

### 3. ODsay API (대중교통 경로)

**발급 경로:**
1. [odsay.com](https://www.odsay.com) 접속 → 회원가입/로그인
2. 마이페이지 → **API 신청**
3. 서비스명: `PocketBon` / URL: `https://pocketbon.vercel.app`
4. 용도: `개인 학습용 PWA 앱 개발` 입력 후 신청
5. 승인 후 API 키 복사 (6개월 무료)

**코드 적용 위치 (`index.html`):**
```js
const ODSAY_KEY = encodeURIComponent('여기에_ODSAY키_입력');
```

---

## 🚀 배포

GitHub에 푸시하면 Vercel이 자동으로 재배포합니다.

```
GitHub push → Vercel 자동 빌드 → 배포 완료
```

---

## 📌 예정 기능

- [ ] 🚇 부산 도시철도 실시간 도착 정보
- [ ] 🎡 AI 룰렛 (Gemini API)
- [ ] 📐 단위 변환기 (cm, 평수, kg 등)
- [ ] 🧭 길찾기 실시간 경로 이탈 감지
- [ ] 🧭 나침반 모드 (이동 방향으로 지도 회전)

---

## 👤 개발자

개인 학습 및 사용 목적으로 제작한 프로젝트입니다.
