// 애니메이션 구역(JM) 명장면 6곳의 실제 성지 자료 — 담당: 지민 (11/27 웹 조사)
// relation: '공식' = 제작사·감독이 모델이라고 밝힌 곳 / '팬 성지' = 팬·관광 매체가 모델로 꼽는 곳
//   → 6곳 모두 제작사 1차 발표를 확인하지 못해서 '팬 성지'로 둠 (관계는 description에 적음)
// photo: 위키미디어 공용의 자유 라이선스 사진만 (작가·라이선스 표시 필수). 없으면 null
//   사진 파일은 public/jm-real/ 에 복사해 둠 (위키미디어 바로 불러오기는 요청이 몰리면 429로 막힘). 출처는 public/jm-real/CREDITS.md
// 자료를 바꾸면 sources(근거 링크)도 같이 바꾸기

const local = (name) => `${import.meta.env.BASE_URL}jm-real/${name}`

export const JM_REAL_SPOTS = {
  crossing: {
    scene: '명장면 ① 「이웃집 토토로」', sceneSub: '비 오는 숲속 정류장',
    nameKo: '토토로의 숲 1호지', nameJa: 'トトロの森 1号地', relation: '팬 성지',
    addressJa: '〒359-1145 埼玉県所沢市上山口351', addressKo: '사이타마현 도코로자와시 가미야마구치 351',
    access: '도코로자와 시내버스 「ところバス」 야마구치 순환 「堀口」에서 걸어서 7분 (세이부큐조마에역에서 걸어서 약 30분)',
    visit: '주차장 없음. 보전 중인 숲이라 정해진 길로만 다니기',
    officialUrl: 'https://www.totoro.or.jp/',
    photo: { src: local('totoro-forest.jpg'), page: 'https://commons.wikimedia.org/wiki/File:Totoro_Forest_1st_area_(2)_2026-05-05.jpg', author: 'Asanagi', license: 'CC0' },
    mapQuery: 'トトロの森1号地',
    description: '영화의 무대로 알려진 사야마 구릉의 숲을 시민 기금(토토로의 고향 기금)이 사들여 지키는 곳이에요. 1호지는 1991년에 처음 사들인 숲이에요. 밤의 버스 정류장 자체는 근처 「稲荷前」 정류장이 모델로 꼽히지만, 자유롭게 쓸 수 있는 사진이 없어 숲으로 안내해요.',
    note: '사쓰키와 메이가 낮에 비를 피한 지장보살 사당은 「上安松地蔵尊」이 모델로 꼽혀요(근거가 약함).',
    sources: ['https://www.city.tokorozawa.saitama.jp/iitokoro/enjoy/kanko/kankou_guide.files/P4-5_nihongo2024.pdf', 'https://www.totoro.or.jp/'],
  },
  stairs: {
    scene: '명장면 ② 「너의 이름은.」', sceneSub: '산 위 신체 사당',
    nameKo: '케타와카미야 신사', nameJa: '気多若宮神社', relation: '팬 성지',
    addressJa: '〒509-4212 岐阜県飛騨市古川町上気多1297', addressKo: '기후현 히다시 후루카와초 가미케타 1297',
    access: 'JR 다카야마 본선 히다후루카와역에서 걸어서 약 14분',
    visit: '참배 자유. 돌계단이 가팔라 비 오는 날 미끄러워요',
    officialUrl: 'https://www.kankou-gifu.jp/spot/detail_5753.html',
    photo: { src: local('keta-wakamiya.jpg'), page: 'https://commons.wikimedia.org/wiki/File:Keta_wakamiya.jpg', author: 'Opqr', license: 'CC BY-SA 4.0' },
    mapQuery: '気多若宮神社',
    description: '히다후루카와 마을이 내려다보이는 언덕의 신사로, 긴 돌계단과 큰 신목으로 알려져 있어요. 주인공이 히다를 찾아가는 장면에 나오는 신사의 모델로 소개되며, 히다후루카와역·시립 도서관과 함께 대표 성지 순례지예요.',
    note: '주인공 마을의 「미야미즈 신사」 모델은 따로 여러 설이 있어요.',
    sources: ['https://www.kankou-gifu.jp/spot/detail_5753.html', 'https://www.gov-online.go.jp/eng/publicity/book/hlj/html/201702/201702_08_jp.html'],
  },
  shrine: {
    scene: '명장면 ③ 「귀멸의 칼날」', sceneSub: '등나무 꽃 숲길',
    nameKo: '호만구 가마도 신사', nameJa: '宝満宮竈門神社', relation: '팬 성지',
    addressJa: '〒818-0115 福岡県太宰府市内山883', addressKo: '후쿠오카현 다자이후시 우치야마 883',
    access: '니시테쓰 다자이후역에서 마을버스 「まほろば号」 약 10분, 종점 「内山」에서 바로',
    visit: '참배 종일 자유, 부적 수여소 8:30~18:00',
    officialUrl: 'https://kamadojinja.or.jp/',
    photo: { src: local('kamado-shrine.jpg'), page: 'https://commons.wikimedia.org/wiki/File:Haiden_of_Kamado_Shrine_3.jpg', author: 'そらみみ', license: 'CC BY-SA 4.0' },
    mapQuery: '宝満宮竈門神社',
    description: '호만산 기슭의 인연 맺기 신사예요. 주인공 「가마도」와 이름이 같아 팬들이 성지로 꼽지만, 작품 무대로 공식 발표된 적은 없어요.',
    note: '등꽃 풍경을 보고 싶다면 도쿄 가메이도텐진샤(4월 등꽃 축제)도 있어요.',
    sources: ['https://www.fun-japan.jp/jp/articles/14426', 'https://www.bushikaku.net/article/118554/'],
  },
  sakura_river: {
    scene: '명장면 ④ 「원령공주」', sceneSub: '이끼 숲과 신령의 연못',
    nameKo: '시라타니운스이쿄 이끼 숲', nameJa: '白谷雲水峡 苔むす森', relation: '팬 성지',
    addressJa: '鹿児島県熊毛郡屋久島町宮之浦（白谷雲水峡）', addressKo: '가고시마현 구마게군 야쿠시마초 미야노우라',
    access: '미야노우라항에서 버스로 「白谷雲水峡」까지 약 35분, 입구에서 이끼 숲까지 왕복 3~4시간',
    visit: '숲 보전 협력금 500엔. 길이 험하니 등산화·우비 필수',
    officialUrl: 'https://www.rinya.maff.go.jp/j/kokuyu_rinya/kokumin_mori/katuyo/reku/rekumori/yakushima_shiratani.html',
    photo: { src: local('shiratani.jpg'), page: 'https://commons.wikimedia.org/wiki/File:Yaku-Island_Shiratani-Unsui-Gorge.jpg', author: 'MaedaAkihiko', license: 'CC0' },
    mapQuery: '白谷雲水峡 苔むす森',
    description: '야쿠시마 국유림 자연휴양림 안, 해발 약 860m의 이끼로 뒤덮인 원시림이에요. 「원령공주」 숲의 모델로 널리 알려져 「원령공주의 숲」이라고도 불려요.',
    note: '지브리의 공식 모델 발표는 확인하지 못했어요.',
    sources: ['https://www.rinya.maff.go.jp/j/kokuyu_rinya/kokumin_mori/katuyo/reku/rekumori/yakushima_shiratani.html', 'https://www.env.go.jp/park/yakushima/ywhcc/route/2-2.html'],
  },
  onsen: {
    scene: '명장면 ⑤ 「센과 치히로의 행방불명」', sceneSub: '온천장으로 가는 붉은 다리',
    nameKo: '에도도쿄 건축물원 고다카라유', nameJa: '江戸東京たてもの園 子宝湯', relation: '팬 성지',
    addressJa: '〒184-0005 東京都小金井市桜町3-7-1（都立小金井公園内）', addressKo: '도쿄도 고가네이시 사쿠라초 3-7-1 (도립 고가네이 공원 안)',
    access: 'JR 주오선 무사시코가네이역 북쪽 출구에서 버스 약 5분, 「小金井公園西口」에서 걸어서 5분',
    visit: '입장료 일반 400엔, 9:30~17:30(10~3월 16:30), 월요일 휴관',
    officialUrl: 'https://www.tatemonoen.jp/',
    photo: { src: local('kodakarayu.jpg'), page: 'https://commons.wikimedia.org/wiki/File:Kodakara-Yu_Entrance.jpg', author: 'TANAKA Juuyoh (田中十洋)', license: 'CC BY 2.0' },
    mapQuery: '江戸東京たてもの園',
    description: '1929년 도쿄 센주에 지어진 대중목욕탕 건물을 야외 건축 박물관으로 옮겨 놓은 곳이에요. 영화의 미술 쪽에서 이 박물관 건물들을 참고했다고 알려져 있고, 고다카라유는 온천장 「유야」의 모티브 가운데 하나로 소개돼요.',
    note: '미야자키 감독 본인은 「특정 모델은 없다」고 했어요.',
    sources: ['https://www.tatemonoen.jp/', 'https://tabi-mag.jp/spiritedaway-kodakarayu/'],
  },
  hill: {
    scene: '명장면 ⑥ 「나츠메 우인장」', sceneSub: '여름 숲 속 작은 신사',
    nameKo: '아마미야 신사', nameJa: '雨宮神社', relation: '팬 성지',
    addressJa: '熊本県球磨郡相良村川辺', addressKo: '구마모토현 구마군 사가라무라 가와베',
    access: 'JR 히토요시역에서 버스 약 20분, 「新曽谷入口」에서 걸어서 약 5분',
    visit: '논 사이 농로로 걸어가요. 논에 들어가거나 길을 막지 않기',
    officialUrl: 'https://www.vill.sagara.lg.jp/',
    photo: null,
    mapQuery: '雨宮神社 相良村',
    description: '논 한가운데 동그랗게 솟은 작은 신사 숲이에요. 원작자의 고향인 구마모토 히토요시·구마 지역이 작품 모델 지역으로 현과 함께 홍보되고 있고, 이 신사는 애니메이션 오프닝에 나온 곳으로 알려져 있어요.',
    note: '자유 이용 사진이 없어 사진은 비워 뒀어요.',
    sources: ['https://kumanichi.com/articles/1996528', 'https://www.fun-japan.jp/jp/articles/13743'],
  },
}
