# 애니메이션 구역(JM) 할 일

담당: 지민. 이 구역 파일(`jm_anime.json`)과 `Map/styles/jm_*.jsx` 에 관한 메모예요.

## 가게 내부 (남은 순서)

들어갈 수 있는 가게는 `jmShopRoom` + `shop.enterable: true` + 눈에 안 보이는 벽(`jmCollider`) 5개로 만들어요.
(`jm_shops.jsx` 맨 위 설명 참고. 내부 가구는 `Interior` 함수에 `look` 별로 추가)

- [x] 천구옥 (골동품) — `jm_antique`
- [x] 깃사 리바운드 (카페) — `jm_cafe_rebound`
- [x] 베이커리 사카노우에 — `jm_bakery`
- [x] 여우 우동 (마치야) — `jm_udon`
- [x] 요괴 찻집 (마치야) — `jm_machiya_4` : 다다미 좌석 + 화과자 진열장 (`shop.interior: "teahouse"`, 겉모습은 마치야 그대로)
- [x] 하레야 잡화점 — `jm_shop_hare` : 천장 우산·테루테루보즈 줄·우산꽂이·장화 선반 (45° 회전: 벽 좌표는 로컬 위치를 45° 돌려서 계산)
- [x] 효카 양조장 — `jm_machiya_1` : 큰 술통·짚 술통 더미, 술병 선반, 시음 카운터 (`interior: "brewery"`, 겉에 스기다마 유지)
- [ ] 4. 시립 도서관 — `jm_library` : 책장 줄, 열람 책상 (-135° 회전)
- [ ] 5. 고전당 서점 — `jm_machiya_2` : 책장, 계산대
- [ ] 6. 가면 가게 — `jm_machiya_5` : 벽에 가면 진열
- [ ] 7. 종이학 문구 — `jm_machiya_6` : 문구 진열대

## 확인할 것

- [ ] 일본어 간판 글자가 웹폰트로 보이는지 (안 보이면 `public/fonts/JM_FONTS.md`)
- [ ] 가게 안에서 3인칭 카메라가 벽에 너무 가리지 않는지
- [ ] 호수 선착장 끝에서 물 위로 못 나가는지
- [ ] 계절 바꿔 보기: 주소 뒤에 `?season=spring` / `summer` / `autumn` / `winter`

## 팀에 공유할 것 (PR 전)

- 근접형 작품명 (「슬램 리바운드」, 「그대의 이름을」, 「나츠키 요괴장」 외 6개)
- 언덕 높이 6.5m (건물 높이 규칙 6~12m의 예외, 지형). 계단은 terrain "stairs"(경사로 충돌 포함) 양쪽 2개
- 「그대의 이름을」 재회의 계단: 남쪽 계단 폭 3.2m·길이 13m, 가운데 빨간 난간(jmStairRail, 계단을 두 줄로 나누는 충돌 벽), 양옆 돌 옹벽 4단
- 애니 구역 서쪽 빈터(K-POP 구역 북쪽, 지민 담당): 호수에서 흘러나온 강(jmRiver) + 남쪽 기슭 산책로(jmPathRibbon) + 다리 2개 + 벚꽃·석등·벤치
  · 구역 밖(x -40 바깥) 좌표지만 jm_anime.json에 함께 둠. 서쪽 담 두 군데(호수 쪽, 남쪽 정류장 옆)를 엶
  · 강둑은 투명 벽(jm_river_bank_*)으로 빠지지 않게, 다리 자리만 비움
  · `shared/places.json`에 촬영지 1곳 추가: spot_jm_sakura_river (「초속 5미터」 벚꽃 강변길) → DB seed도 다시 생성함
- 옥상 신사 건물(jm_rooftop) 안 계단 3번 → 옥상 (terrain stairs 3개 + jmCollider 벽·층계참·옥상 바닥)
- 농구 슛·비 오는 정류장 체험 (jm_activities.jsx, jm_activityStore.js)
- `shared/places.json` 스탬프 지점 3곳 추가
- `Map/styles/index.js` 등록 2줄
- `public/fonts` 웹폰트 2개 (OFL)
- 맵 전체 조명이 어둡게 느껴짐 → 조명은 공용 `Scene.jsx` 라서 병관님과 상의
