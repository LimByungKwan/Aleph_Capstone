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
  ('cafe_soran', 'cafe', 'BK', '소란 커피', '드라마 「여름이 머무는 정류장」'),
  ('spot_bk_tower', 'spot', 'BK', '별빛 전망대', '드라마 「밤하늘 아래 우리」'),
  ('spot_bk_fountain', 'spot', 'BK', '소원 분수 광장', '드라마 「밤하늘 아래 우리」'),
  ('spot_bk_claw', 'spot', 'BK', '한옥 인형뽑기 부스', '드라마 「밤하늘 아래 우리」'),
  ('spot_jm_crossing', 'spot', 'JM', '명장면 ① 비 오는 숲속 정류장', '애니메이션 「이웃집 토토로」'),
  ('spot_jm_stairs', 'spot', 'JM', '명장면 ② 노을 지는 붉은 난간 계단', '애니메이션 「너의 이름은.」'),
  ('spot_jm_shrine', 'spot', 'JM', '명장면 ③ 안개 숲의 갈라진 바위', '애니메이션 「귀멸의 칼날」'),
  ('spot_jm_sakura_river', 'spot', 'JM', '명장면 ④ 벚꽃 날리는 철길 건널목', '애니메이션 「초속 5센티미터」'),
  ('spot_sg_stage', 'spot', 'SG', 'SUNSET WAVE 야외무대', 'K-POP 「SUNGRAY: SUNSET WAVE」'),
  ('shop_sg_bdaycafe', 'cafe', 'SG', 'happy birthday yunseul~!!', 'K-POP 「SUNGRAY: SUNSET WAVE」'),
  ('shop_sg_goods', 'cafe', 'SG', 'SUNGRAY 공식 팝업스토어', 'K-POP 「SUNGRAY: SUNSET WAVE」')
on conflict (id) do update set type = excluded.type, zone = excluded.zone, name = excluded.name, work = excluded.work;

insert into public.shop_offers (shop_id, title, discount, perk, menu, valid_days) values
  ('shop_hj_snack', '정류장 분식 떡볶이 사이즈 업 쿠폰', 'SIZE UP', '떡볶이 사이즈 업', '비 오는 날 떡볶이', 30)
on conflict (shop_id) do update set title = excluded.title, discount = excluded.discount, perk = excluded.perk, menu = excluded.menu, valid_days = excluded.valid_days;

insert into public.activities (id, name, min_seconds) values
  ('jm_hoop', '농구 슛 체험', 5),
  ('jm_busstop', '비 오는 정류장 체험', 8),
  ('jm_skip', '물수제비 체험', 3)
on conflict (id) do update set name = excluded.name, min_seconds = excluded.min_seconds;
