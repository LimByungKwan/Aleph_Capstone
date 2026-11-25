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
  ('spot_jm_crossing', 'spot', 'JM', '「슬램 리바운드」 오프닝 건널목', '애니메이션 「슬램 리바운드」'),
  ('spot_jm_stairs', 'spot', 'JM', '「그대의 이름을」 재회의 계단', '애니메이션 「그대의 이름을」'),
  ('spot_jm_shrine', 'spot', 'JM', '「나츠키 요괴장」 여우 신사', '애니메이션 「나츠키 요괴장」'),
  ('spot_jm_sakura_river', 'spot', 'JM', '「초속 5미터」 벚꽃 강변길', '애니메이션 「초속 5미터」'),
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
