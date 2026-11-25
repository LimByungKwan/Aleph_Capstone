import locations from '../../data/specialLocations.json' with { type: 'json' }

// 이 ID들은 기존 스탬프 저장 기록과 3D 장면에서 함께 사용합니다.
export const SPECIAL_IDS = {
  throne: 'geunjeongjeon_throne', pavilion: 'gyeonghoeru_2f', residence: 'geoncheonggung_inner',
  gate: 'gwanghwamun_axis', central: 'former_governor_hall', station: 'gyeongseong_station_vip',
  press: 'gyeongseong_press_salon', prison: 'seodaemun_prison_wall',
}

const reference = (name, url) => ({ name, url })
const SCENE_DETAILS = {
  [SPECIAL_IDS.throne]: {
    short: '근정전 왕의 자리',
    scanLabel: '광화문 쪽 궁궐 중심축',
    introduction: {
      ko: '‘어좌’는 왕이 공식 행사를 진행할 때 앉던 의자예요. 이 가상 궁궐에서는 왕의 자리에 앉아 볼 수 있어요.',
      en: 'The throne is the chair where the king sat during official ceremonies. You can sit on it in this virtual palace.',
    },
    references: [
      reference('국가유산청 · 근정전', 'https://www.heritage.go.kr/heri/cul/culSelectDetail.do?VdkVgwKey=11%2C02230000%2C11'),
      reference('궁능유적본부 · 관람 규칙', 'https://royal.khs.go.kr/ROYAL/contents/R704000000.do?schGroupCode=gbg'),
      reference('한국관광공사 · 용인 대장금파크', 'https://korean.visitkorea.or.kr/detail/ms_detail.do?cotid=c8e33dab-4f7e-4f78-8aff-7f12518e1663'),
    ],
  },
  [SPECIAL_IDS.pavilion]: {
    short: '경회루 2층',
    references: [
      reference('궁능유적본부 · 경회루 특별관람', 'https://royal.khs.go.kr/ROYAL/contents/R402000000.do?id=20260318082201573013&schBcid=normal1&schM=view'),
      reference('국가유산포털 · 경회루', 'https://www.heritage.go.kr/heri/cul/culSelectDetail.do?VdkVgwKey=11%2C02240000%2C11'),
    ],
  },
  [SPECIAL_IDS.residence]: {
    short: '건청궁 곤녕합',
    references: [
      reference('한국학중앙연구원 · 건청궁', 'https://encykorea.aks.ac.kr/Article/E0002436'),
      reference('정책브리핑 · 건청궁 전등과 개방', 'https://www.korea.kr/news/policyNewsView.do?newsId=148639038'),
    ],
  },
  [SPECIAL_IDS.gate]: {
    short: '광화문 월대',
    references: [reference('국가유산청 · 광화문 월대', 'https://khs.go.kr/cop/bbs/selectBoardArticle.do?bbsId=BBSMSTR_1008&mn=NS_01_09_01&nttId=87185')],
  },
  [SPECIAL_IDS.central]: {
    short: '옛 중앙청 홀',
    visitNote: '청사의 철거는 1995년에 시작해 1996년에 마무리되었습니다.',
    references: [
      reference('국사편찬위원회 · 우리역사넷', 'https://contents.history.go.kr/mobile/eh/view.do?code=ganada&levelId=eh_r0334_0010'),
      reference('경남영상자료관 · 100일의 거짓말', 'https://www.gnfilm.or.kr/location/filmshow/127'),
    ],
  },
  [SPECIAL_IDS.station]: {
    short: '경성역 귀빈실·2층',
    visitNote: '문화역서울284의 실제 귀빈실은 1층에 있습니다. 게임 속 2층 비밀 아지트는 가상 공간입니다.',
    references: [
      reference('문화역서울284 · 공간 안내', 'https://www.seoul284.org/program/view/category/319/state/4/menu/330?idx=284'),
      reference('문화역서울284 · 1925년 역사', 'https://www.seoul284.org/cms/content/view/253'),
      reference('한국관광공사 · 논산 촬영지', 'https://korean.visitkorea.or.kr/detail/rem_detail.do?cotid=245303e2-b9e8-4c02-a8a1-a28632fa8d8a'),
    ],
  },
  [SPECIAL_IDS.press]: {
    short: '경성 다방·인쇄실',
    scanLabel: '창 너머 전차 거리',
    additionalScanTargets: [{ yaw: 0, label: '뒤편 인쇄기' }],
    visitNote: '게임 속 2층 인쇄실과 아래층 다방은 근대 경성에서 모티브를 얻어 구성한 가상 공간입니다.',
    references: [reference('국사편찬위원회 · 일제강점기 언론 통제', 'https://contents.history.go.kr/front/nh/view.do?levelId=nh_051_0030_0010_0010')],
  },
  [SPECIAL_IDS.prison]: {
    short: '서대문 격벽장',
    references: [
      reference('정책브리핑 · 격벽장 사료', 'https://www.korea.kr/multi/policyPhotoView.do?bbsKey=20815'),
      reference('대한민국역사박물관 · 서대문형무소역사관', 'https://www.much.go.kr/cooperation/net/sscm.do'),
    ],
  },
}

// [3. 개발 > 프론트엔드] 관람 데이터는 JSON에서 가져오고, 게임 카메라의 좌표계에 맞춰 각도를 변환합니다.
export const SPECIAL_LOCATIONS = [...locations.spots].sort((a, b) => a.order - b.order).map((spot) => {
  const { scanLabel, additionalScanTargets = [], ...scene } = SCENE_DETAILS[spot.id]
  const mechanic = spot.restoration_mechanic
  const { real_spot_name, kakao_map_url } = spot.o2o_location
  return {
    ...scene,
    id: spot.id,
    title: spot.title,
    era: spot.era,
    mechanicType: spot.mechanic_type,
    restrictionFact: spot.restriction_fact,
    filmingBehind: spot.filming_behind,
    realLocation: real_spot_name,
    kakaoMapUrl: kakao_map_url,
    personaGuides: spot.persona_guides,
    sources: spot.sources,
    actionCue: mechanic.action_cue,
    completionMessage: mechanic.completion_message,
    sliderBeforeLabel: mechanic.before_label,
    sliderAfterLabel: mechanic.after_label,
    factOptions: mechanic.options,
    scanTargets: spot.mechanic_type === 'angle_scan'
      ? [{ yaw: (mechanic.target_yaw_deg + 180) % 360, label: scanLabel }, ...additionalScanTargets]
      : undefined,
  }
})

const spotsById = new Map(SPECIAL_LOCATIONS.map((spot) => [spot.id, spot]))
export const getSpecialLocation = (id) => spotsById.get(id)

export const ERA_BADGES = {
  joseon: ['조선 시대 경복궁 사극 촬영 구역', '현실 출입제한 4곳 특별 개방 중'],
  colonial: ['1930년대 경성 시대극 촬영 구역', '소실/통제 구역 4곳 가상 복원 중'],
}

export const MECHANIC_LABELS = { angle_scan: '🧭 앵글', era_slider: '🎚️ 슬라이더', fact_check: '🔍 팩트체크' }

export const SEOUL_ROUTE = 'https://map.kakao.com/link/by/foot/'
  + encodeURIComponent('경복궁') + ',37.5760,126.9769/'
  + encodeURIComponent('문화역서울284') + ',37.5563,126.9717'
