# 애니메이션 구역(JM) 웹폰트

| 파일 | 글꼴 | 쓰는 곳 | 라이선스 |
|---|---|---|---|
| `jm-zen-maru-gothic-700.woff2` | Zen Maru Gothic Bold | 일본어 간판 (가게, 역, 학교, 제등) | SIL Open Font License 1.1 |
| `jm-gowun-dodum.woff2` | Gowun Dodum | 성지 안내판의 한국어 제목·설명 | SIL Open Font License 1.1 |

둘 다 Google Fonts의 무료 글꼴이에요. 용량을 줄이려고 **지금 간판·안내판에 쓰는 글자만** 들어 있어요
(일본어 파일에는 히라가나·가타카나 전체도 포함). 없는 글자는 기본 글꼴로 보여요.

- 11/24: 여관·명장면 간판 한자 59자가 빠져 있어서 일본어 파일을 다시 받음. 지금은 `jm_*.jsx`·`jm_anime.json`에 나오는 일본어 글자 전부 + 11/17 파일에 있던 글자 전부가 들어 있음
- 11/25: 운하 거리 여관 세로 간판·가게 노렌 글자를 넣고 다시 받음. 이번부터는 `jm_*.jsx`·`jm_anime.json`에 나오는 일본어 글자 + 히라가나·가타카나 전체만 모아서 받음 (안 쓰는 옛 글자는 빠짐)
- 간판 글자를 새로 넣으면 꼭 다시 받기. 빠진 글자는 미리보기 콘솔에서 글꼴 있음/없음으로 그린 그림을 비교해서 찾을 수 있음

## 글자를 추가했을 때 다시 받는 방법

1. 필요한 글자를 모아서 Google Fonts 주소의 `text=` 에 넣어요 (주소용으로 인코딩).
   - 일본어: `https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@700&text=글자들`
   - 한국어: `https://fonts.googleapis.com/css2?family=Gowun+Dodum&text=글자들`
2. 브라우저(크롬)로 그 주소를 열면 CSS가 나와요. 안의 `url(...)` 주소에서 woff2 파일을 받아요.
3. 같은 파일 이름으로 이 폴더에 덮어써요.

코드: `frontend/src/game/Map/styles/jm_landmarks.jsx` 의 `FontFace` 부분.
