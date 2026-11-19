// [2. 설계 > 사용자 시나리오] 촬영지 "안으로 들어가기" 장면 데이터 (혜진 영화·드라마 구역)
// placeId(shared/places.json) → 들어가면 보이는 장면.
// ⚠ 모든 작품·대사는 가상으로 새로 쓴 것이에요. 실제 드라마 제목·대사·배우 이름은 쓰지 않아요 (팀 규칙).
export const SCENES = {
  spot_hj_breakwater: {
    id: 'breakwater',
    enterLabel: '🌊 방파제 안으로 들어가기',
    transition: 'wave',
    title: '등대 명장면 방파제 포토존 & 스토리',
    work: '영화 「등대가 켜지면」 (가상 작품)',
    story:
      '바다로 떠난 사람을 기다리던 주인공은, 해 질 무렵마다 방파제 끝 붉은 등대 아래에 섰다. ' +
      '마지막 장면에서 등대 불이 켜지는 순간, 멀리서 배 한 척이 천천히 돌아온다.',
    // 화면 아래 대화창에 차례로 나오는 대사 (가상 작품의 새 대사)
    dialogue: [
      { speaker: '해원', line: '등대 불이 켜지면, 내가 아직 여기 있다는 뜻이야.' },
      { speaker: '도윤', line: '파도가 몇 번을 지워도, 우리가 앉았던 자리는 그대로더라.' },
      { speaker: '해원', line: '바다는 매일 다른 색인데, 돌아오는 배를 볼 때면 늘 같은 마음이 들어.' },
    ],
    photoAction: '💐 꽃다발 들고 인증샷 남기기',
    photoCaption: '방파제 끝, 등대 아래에서',
    stampLabel: '방파제 스탬프',
  },
}

export const sceneForPlace = (placeId) => SCENES[placeId] ?? null

// 실제 작품명은 촬영 세트 이름표에 쓰고 대화는 프로젝트용으로 새로 작성했어요.
export const ANALOG_SCENES = {
  palace: { id: 'haewol-palace', retroScene: true, title: '해월궁 정전',
    speaker: '궁궐을 지키는 수문장', synopsis: '문이 닫히기 전 마당을 둘러보시오. 달이 뜨면 정전의 기왓골마다 불빛이 한 줄씩 걸린다오.' },
  moonForest: { id: 'moon-forest', retroScene: true, title: '달빛 여우 사당',
    speaker: '숲의 수호자', synopsis: '달이 낮게 뜨는 날엔 숲길이 하나 더 생겨. 길을 잃으면 저 돌여우가 바라보는 쪽으로 걸어.' },
  moonHanok: { id: 'moon-hanok', retroScene: true, title: '달그림자 한옥',
    speaker: '한옥지기', synopsis: '밤마다 대문 앞에 발자국이 하나씩 늘더라. 오늘은 겁내지 말라고 등잔을 켜 두었어.' },
  basement: { id: 'analog-basement', retroScene: true, title: '기생충 반지하 계단',
    speaker: '계단 아래 주민', synopsis: '비가 오면 저 창문으로 거리의 불빛이 내려와. 오늘은 계단 위까지만 물이 차면 좋겠다.' },
  alley: { id: 'analog-alley', retroScene: true, title: '응답하라 1988 골목',
    speaker: '골목 친구', synopsis: '가로등 불이 켜지면 집에 가야 하는데, 오늘은 너희랑 한 판만 더 놀고 싶다.' },
  hanok: { id: 'analog-hanok', retroScene: true, title: '건축학개론 한옥',
    speaker: '한옥을 찾은 손님', synopsis: '대문을 열었더니 나무 냄새가 그대로더라. 오랜만에 돌아온 기분이었어.' },
  store: { id: 'analog-store', retroScene: true, title: '7080 추억의 구멍가게',
    speaker: '구멍가게 주인', synopsis: '외상값은 다음에 가져와. 매일 앉던 평상 자리도 오늘은 비워 뒀어.' },
}

export const HJ_DIALOGUE = {
  spot_hj_breakwater: [
    { speaker: '해원', line: '노을이 바다 끝에 걸리면, 우리 잠깐만 여기 더 있을래?' },
  ],
  spot_hj_vintage: [
    { speaker: '서진', line: '파란 대문에 기대 있을게. 네 자전거 종소리는 멀리서도 알아듣거든.' },
    { speaker: '유준', line: '오늘은 골목 끝까지 천천히 가자. 저 전구가 켜지는 것도 보고 싶어.' },
  ],
  spot_wall: [
    { speaker: '순덕', line: '나무 평상에 앉으면 대문 여는 소리만으로도 누가 오는지 알았지.' },
    { speaker: '연희', line: '그럼 오늘은 내가 먼저 와서 네 자리를 데워 둘게.' },
  ],
  spot_busstop: [
    { speaker: '지안', line: '막차 놓쳐도 괜찮아. 빗소리가 이렇게 가까운 건 오랜만이니까.' },
    { speaker: '현수', line: '그럼 건너편 분식집까지 같이 갈래? 아직 불이 켜져 있어.' },
  ],
  shop_hj_snack: [
    { speaker: '분식집 주인', line: '우산은 문 옆에 두고 와. 떡볶이가 막 끓었으니 여기서 몸 좀 녹이고 가.' },
  ],
}
