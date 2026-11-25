-- 자동 생성 파일입니다. 직접 고치지 말고 `node supabase/gen_seed.mjs`로 다시 만드세요.
-- 원본: shared/places.json

insert into public.places (id, type, zone, name, work) values
  ('npc_guide', 'npc', 'HUB', 'AI 가이드 ''루미''', null),
  ('spot_busstop', 'spot', 'HJ', '여름 정류장', '드라마 「여름이 머무는 정류장」'),
  ('shop_hj_snack', 'cafe', 'HJ', '정류장 분식', '드라마 「여름이 머무는 정류장」'),
  ('spot_hj_vintage', 'spot', 'HJ', '빈티지 골목', '영화 「필름 속 그 골목」'),
  ('spot_hj_breakwater', 'spot', 'HJ', '방파제 & 등대', '영화 「등대가 켜지면」'),
  ('spot_mural', 'spot', 'BK', '날개 벽화 골목', '영화 「골목 끝의 빛」'),
  ('spot_wall', 'spot', 'HJ', '골목길 고백 담벼락', '웹드라마 「너의 담벼락」'),
  ('spot_hj_geunjeongjeon', 'spot', 'HJ', '근정전 앞마당', '드라마 「왕실의 우산」'),
  ('spot_hj_gyeonghoeru', 'spot', 'HJ', '경회루 누각', '드라마 「홍천의 화공」'),
  ('spot_hj_hyangwonjeong', 'spot', 'HJ', '향원정 달밤 다리', '드라마 「동궁의 봄」'),
  ('cafe_soran', 'cafe', 'BK', '소란 커피', '드라마 「여름이 머무는 정류장」'),
  ('spot_bk_tower', 'spot', 'BK', '별빛 전망대', '드라마 「밤하늘 아래 우리」'),
  ('spot_bk_fountain', 'spot', 'BK', '소원 분수 광장', '드라마 「밤하늘 아래 우리」'),
  ('spot_bk_claw', 'spot', 'BK', '한옥 인형뽑기 부스', '드라마 「밤하늘 아래 우리」'),
  ('spot_jm_crossing', 'spot', 'JM', '명장면 ① 비 오는 숲속 정류장', '애니메이션 「이웃집 토토로」'),
  ('spot_jm_stairs', 'spot', 'JM', '명장면 ② 산 위 신체 사당', '애니메이션 「너의 이름은.」'),
  ('spot_jm_shrine', 'spot', 'JM', '명장면 ③ 등나무 꽃 숲길', '애니메이션 「귀멸의 칼날」'),
  ('spot_jm_sakura_river', 'spot', 'JM', '명장면 ④ 이끼 숲과 신령의 연못', '애니메이션 「원령공주」'),
  ('spot_jm_onsen', 'spot', 'JM', '명장면 ⑤ 온천장으로 가는 붉은 다리', '애니메이션 「센과 치히로의 행방불명」'),
  ('shop_jm_donguri', 'cafe', 'JM', '도토리 찻집 「どんぐり茶屋」', '애니메이션 「이웃집 토토로」'),
  ('shop_jm_kumihimo', 'cafe', 'JM', '매듭끈 가게 「組紐 結び屋」', '애니메이션 「너의 이름은.」'),
  ('shop_jm_fuji', 'cafe', 'JM', '등꽃 찻집 「藤の花茶屋」', '애니메이션 「귀멸의 칼날」'),
  ('shop_jm_sakura', 'cafe', 'JM', '이끼 찻집 「苔むす茶屋」', '애니메이션 「원령공주」'),
  ('shop_jm_manju', 'cafe', 'JM', '온천 찐빵 가게 「湯けむり饅頭」', '애니메이션 「센과 치히로의 행방불명」'),
  ('spot_jm_hill', 'spot', 'JM', '명장면 ⑥ 여름 숲 속 작은 신사', '애니메이션 「나츠메 우인장」'),
  ('shop_jm_antique', 'cafe', 'JM', '요괴 과자점 「妖の菓子屋」', '애니메이션 「나츠메 우인장」'),
  ('spot_sg_stage', 'spot', 'SG', 'SUNSET WAVE 야외무대', 'K-POP 「SUNGRAY: SUNSET WAVE」'),
  ('shop_sg_bdaycafe', 'cafe', 'SG', 'happy birthday yunseul~!!', 'K-POP 「SUNGRAY: SUNSET WAVE」'),
  ('shop_sg_goods', 'cafe', 'SG', 'SUNGRAY 공식 팝업스토어', 'K-POP 「SUNGRAY: SUNSET WAVE」')
on conflict (id) do update set type = excluded.type, zone = excluded.zone, name = excluded.name, work = excluded.work;

insert into public.shop_offers (shop_id, title, discount, perk, menu, valid_days) values
  ('shop_hj_snack', '정류장 분식 떡볶이 사이즈 업 쿠폰', 'SIZE UP', '떡볶이 사이즈 업', '비 오는 날 떡볶이', 30),
  ('shop_jm_donguri', '도토리 찻집 보리차 한 잔 무료 쿠폰', 'FREE TEA', '보리차 한 잔 무료', '도토리 쿠키와 보리차', 30),
  ('shop_jm_kumihimo', '매듭끈 가게 만들기 체험 20% 할인권', '20% OFF', '매듭끈 만들기 20% 할인', '손목 매듭끈 만들기', 30),
  ('shop_jm_fuji', '등꽃 찻집 경단 1+1 쿠폰', '1+1', '등꽃 경단 하나 더', '등꽃 경단과 말차', 30),
  ('shop_jm_antique', '요괴 과자점 만주 하나 무료 쿠폰', 'FREE', '고양이 만주 하나 무료', '고양이 모양 만주', 30),
  ('shop_jm_sakura', '이끼 찻집 쑥떡 1+1 쿠폰', '1+1', '쑥떡 하나 더', '쑥떡과 숲 차', 30),
  ('shop_jm_manju', '온천 찐빵 가게 찐빵 하나 무료 쿠폰', 'FREE', '팥 찐빵 하나 무료', '온천 김에 찐 팥 찐빵', 30)
on conflict (shop_id) do update set title = excluded.title, discount = excluded.discount, perk = excluded.perk, menu = excluded.menu, valid_days = excluded.valid_days;

insert into public.activities (id, name, min_seconds) values
  ('jm_hoop', '농구 슛 체험', 5),
  ('jm_busstop', '비 오는 정류장 체험', 8),
  ('jm_skip', '물수제비 체험', 3)
on conflict (id) do update set name = excluded.name, min_seconds = excluded.min_seconds;
