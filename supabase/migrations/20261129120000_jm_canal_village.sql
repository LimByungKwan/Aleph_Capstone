-- 애니 구역 명장면 마당 (11/25, 지민)
-- 명장면을 맵 밖 장면 공간에서 맵 안으로 옮기면서 (파일 이름의 canal_village는 처음 안의 이름)
-- (11/25 밤) 장면 다시 고름: 마을(낡은 일본 요괴 마을)에 맞게 ② 너의 이름은 신체 사당, ③ 귀멸의 칼날 등나무 숲길, ④ 원령공주 이끼 숲, ⑥ 나츠메 우인장 작은 신사 (id는 그대로 다시 씀)
-- (11/25 오후) 구역 전체를 「센과 치히로」 배경 마을로: ①~④는 음식점 거리 골목 끝 마당, ⑤는 온천장 앞 붉은 다리 위
--   ① 명장면 ⑤ 스탬프 장소(spot_jm_onsen) 추가
--   ② 명장면마다 같은 작품 가게(type='cafe') 5곳 추가 → 스탬프를 받으면 그 작품 가게 쿠폰이 나옴 (stamp 함수의 "같은 구역 + 같은 작품" 규칙 그대로)
--   ③ 가게 쿠폰 혜택(shop_offers)
-- 스탬프 기록·기존 장소 id는 그대로. 여러 번 실행해도 결과가 같음
-- 원본: shared/places.json (supabase/seed.sql 도 같은 내용으로 다시 만듦)

insert into public.places (id, type, zone, name, work) values
  ('spot_jm_onsen', 'spot', 'JM', '명장면 ⑤ 온천장으로 가는 붉은 다리', '애니메이션 「센과 치히로의 행방불명」'),
  ('shop_jm_donguri', 'cafe', 'JM', '도토리 찻집 「どんぐり茶屋」', '애니메이션 「이웃집 토토로」'),
  ('shop_jm_kumihimo', 'cafe', 'JM', '매듭끈 가게 「組紐 結び屋」', '애니메이션 「너의 이름은.」'),
  ('spot_jm_shrine', 'spot', 'JM', '명장면 ③ 등나무 꽃 숲길', '애니메이션 「귀멸의 칼날」'),
  ('spot_jm_stairs', 'spot', 'JM', '명장면 ② 산 위 신체 사당', '애니메이션 「너의 이름은.」'),
  ('spot_jm_sakura_river', 'spot', 'JM', '명장면 ④ 이끼 숲과 신령의 연못', '애니메이션 「원령공주」'),
  ('spot_jm_hill', 'spot', 'JM', '명장면 ⑥ 여름 숲 속 작은 신사', '애니메이션 「나츠메 우인장」'),
  ('shop_jm_fuji', 'cafe', 'JM', '등꽃 찻집 「藤の花茶屋」', '애니메이션 「귀멸의 칼날」'),
  ('shop_jm_antique', 'cafe', 'JM', '요괴 과자점 「妖の菓子屋」', '애니메이션 「나츠메 우인장」'),
  ('shop_jm_sakura', 'cafe', 'JM', '이끼 찻집 「苔むす茶屋」', '애니메이션 「원령공주」'),
  ('shop_jm_manju', 'cafe', 'JM', '온천 찐빵 가게 「湯けむり饅頭」', '애니메이션 「센과 치히로의 행방불명」')
on conflict (id) do update set type = excluded.type, zone = excluded.zone, name = excluded.name, work = excluded.work;

insert into public.shop_offers (shop_id, title, discount, perk, menu, valid_days) values
  ('shop_jm_donguri', '도토리 찻집 보리차 한 잔 무료 쿠폰', 'FREE TEA', '보리차 한 잔 무료', '도토리 쿠키와 보리차', 30),
  ('shop_jm_kumihimo', '매듭끈 가게 만들기 체험 20% 할인권', '20% OFF', '매듭끈 만들기 20% 할인', '손목 매듭끈 만들기', 30),
  ('shop_jm_fuji', '등꽃 찻집 경단 1+1 쿠폰', '1+1', '등꽃 경단 하나 더', '등꽃 경단과 말차', 30),
  ('shop_jm_antique', '요괴 과자점 만주 하나 무료 쿠폰', 'FREE', '고양이 만주 하나 무료', '고양이 모양 만주', 30),
  ('shop_jm_sakura', '이끼 찻집 쑥떡 1+1 쿠폰', '1+1', '쑥떡 하나 더', '쑥떡과 숲 차', 30),
  ('shop_jm_manju', '온천 찐빵 가게 찐빵 하나 무료 쿠폰', 'FREE', '팥 찐빵 하나 무료', '온천 김에 찐 팥 찐빵', 30)
on conflict (shop_id) do update set title = excluded.title, discount = excluded.discount, perk = excluded.perk, menu = excluded.menu, valid_days = excluded.valid_days;
