-- 애니 구역 명장면 마당 (11/25, 지민)
-- 명장면을 맵 밖 장면 공간에서 맵 안으로 옮기면서 (파일 이름의 canal_village는 처음 안의 이름)
-- (11/25 밤) 장면 다시 고름: ③ 귀멸의 칼날 → 마녀 배달부 키키 빵집 언덕길(같은 id 다시 씀), ⑥ 귀를 기울이면 언덕 계단 추가
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
  ('spot_jm_shrine', 'spot', 'JM', '명장면 ③ 바다가 보이는 빵집 언덕길', '애니메이션 「마녀 배달부 키키」'),
  ('spot_jm_hill', 'spot', 'JM', '명장면 ⑥ 언덕 위 골동품점 계단', '애니메이션 「귀를 기울이면」'),
  ('shop_jm_fuji', 'cafe', 'JM', '언덕길 빵집 「海辺のパン屋」', '애니메이션 「마녀 배달부 키키」'),
  ('shop_jm_antique', 'cafe', 'JM', '시계 골동품점 「時計の骨董店」', '애니메이션 「귀를 기울이면」'),
  ('shop_jm_sakura', 'cafe', 'JM', '벚꽃떡 가게 「桜餅 花便り」', '애니메이션 「초속 5센티미터」'),
  ('shop_jm_manju', 'cafe', 'JM', '온천 찐빵 가게 「湯けむり饅頭」', '애니메이션 「센과 치히로의 행방불명」')
on conflict (id) do update set type = excluded.type, zone = excluded.zone, name = excluded.name, work = excluded.work;

insert into public.shop_offers (shop_id, title, discount, perk, menu, valid_days) values
  ('shop_jm_donguri', '도토리 찻집 보리차 한 잔 무료 쿠폰', 'FREE TEA', '보리차 한 잔 무료', '도토리 쿠키와 보리차', 30),
  ('shop_jm_kumihimo', '매듭끈 가게 만들기 체험 20% 할인권', '20% OFF', '매듭끈 만들기 20% 할인', '손목 매듭끈 만들기', 30),
  ('shop_jm_fuji', '언덕길 빵집 갓 구운 빵 1+1 쿠폰', '1+1', '갓 구운 빵 하나 더', '갓 구운 빵과 우유', 30),
  ('shop_jm_antique', '시계 골동품점 엽서 한 장 무료 쿠폰', 'FREE', '골동품점 엽서 한 장', '오래된 괘종시계 구경', 30),
  ('shop_jm_sakura', '벚꽃떡 가게 벚꽃 찹쌀떡 1+1 쿠폰', '1+1', '벚꽃 찹쌀떡 하나 더', '벚꽃 찹쌀떡', 30),
  ('shop_jm_manju', '온천 찐빵 가게 찐빵 하나 무료 쿠폰', 'FREE', '팥 찐빵 하나 무료', '온천 김에 찐 팥 찐빵', 30)
on conflict (shop_id) do update set title = excluded.title, discount = excluded.discount, perk = excluded.perk, menu = excluded.menu, valid_days = excluded.valid_days;
