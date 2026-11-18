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
  ('spot_jm_crossing', 'spot', 'JM', '「슬램 리바운드」 오프닝 건널목', '애니메이션 「슬램 리바운드」'),
  ('spot_jm_stairs', 'spot', 'JM', '「그대의 이름을」 재회의 계단', '애니메이션 「그대의 이름을」'),
  ('spot_jm_shrine', 'spot', 'JM', '「나츠키 요괴장」 여우 신사', '애니메이션 「나츠키 요괴장」')
on conflict (id) do update set type = excluded.type, zone = excluded.zone, name = excluded.name, work = excluded.work;

insert into public.shop_offers (shop_id, title, discount, perk, menu, valid_days) values
  ('shop_hj_snack', '정류장 분식 떡볶이 사이즈 업 쿠폰', 'SIZE UP', '떡볶이 사이즈 업', '비 오는 날 떡볶이', 30)
on conflict (shop_id) do update set title = excluded.title, discount = excluded.discount, perk = excluded.perk, menu = excluded.menu, valid_days = excluded.valid_days;

insert into public.activities (id, name, min_seconds) values
  ('jm_hoop', '농구 슛 체험', 5),
  ('jm_busstop', '비 오는 정류장 체험', 8)
on conflict (id) do update set name = excluded.name, min_seconds = excluded.min_seconds;
