-- 애니 구역 스탬프 4곳 이름·작품명을 shared/places.json(명장면 공간, 원작 작품명)과 맞춤 (11/24, 지민)
-- 이유: 관리자 화면 「인기 장소」는 이름을 DB(places.name)에서 읽어서, 게임 화면과 다른 옛 이름이 보였음
-- id·type·zone은 그대로라 스탬프 기록·쿠폰 조건에는 영향 없음 (애니 구역엔 같은 작품 가게가 없음)
-- 여러 번 실행해도 결과가 같음

update public.places set name = '명장면 ① 비 오는 숲속 정류장', work = '애니메이션 「이웃집 토토로」'
where id = 'spot_jm_crossing';

update public.places set name = '명장면 ② 노을 지는 붉은 난간 계단', work = '애니메이션 「너의 이름은.」'
where id = 'spot_jm_stairs';

update public.places set name = '명장면 ③ 안개 숲의 갈라진 바위', work = '애니메이션 「귀멸의 칼날」'
where id = 'spot_jm_shrine';

update public.places set name = '명장면 ④ 벚꽃 날리는 철길 건널목', work = '애니메이션 「초속 5센티미터」'
where id = 'spot_jm_sakura_river';
