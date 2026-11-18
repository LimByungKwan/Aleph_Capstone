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
