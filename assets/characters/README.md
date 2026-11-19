# 남녀 플레이어 캐릭터

사용자가 제공한 Meshy FBX의 외형·텍스처와 Mixamo 동작 5개로 제작했습니다.

| 캐릭터 | 게임용 파일 | 편집용 파일 | 키 | 뼈대 |
|---|---|---|---|---|
| 남자 | `../../frontend/public/models/characters/male.glb` | `male.blend` | 1.72m | 22 bones |
| 여자 | `../../frontend/public/models/characters/female.glb` | `female.blend` | 1.66m | 22 bones |

각 GLB는 텍스처를 내장한 독립 파일입니다. Blender 파일도 텍스처를 포함하며 Idle 동작으로 열립니다. Action Editor에서 Idle / Walk / Run / Jump / Sit를 선택해 편집할 수 있습니다. 이미지 `male-preview.png`, `female-preview.png`는 제작한 모델의 실제 Blender 렌더입니다.

## 포함 동작

- Idle: `기본 자세.fbx`, 6초
- Walk: `걷기.fbx`, 1초
- Run: `달리기.fbx`, 0.7초
- Jump: `Jump.fbx`, 1초 (비반복, 수직 이동은 게임 물리가 처리)

원본에 없던 뼈대를 체형에 맞춰 생성했습니다. 자동 웨이트 후 분리 정점, 머리, 영향 뼈 개수 및 정규화를 보정했습니다. 원본은 약 10만 폴리곤이며 게임용으로 단순화하고 텍스처를 2048px로 조정했습니다. GLB는 각각 약 4.3MB입니다. 수평 루트 이동을 제거하고 발의 바닥 관통과 반복 마지막 프레임을 보정했습니다. 손가락은 손 뼈에 함께 연결되며 별도 손가락·표정·머리카락 물리 동작은 포함하지 않습니다.

## 로컬 앱에서 사용

`frontend`에서 `npm run dev`를 실행하고 오른쪽 위 **설정 → 캐릭터 → 남자 캐릭터 / 여자 캐릭터**를 선택합니다. WASD/방향키로 걷고 Shift로 달리고 스페이스바로 점프합니다. 착지하면 이동 동작으로 부드럽게 돌아옵니다. 기본 이동 속도는 걷기 1.6m/s, 달리기 4.2m/s입니다. 실제 지면 상대 속도를 사용해 애니메이션 가중치와 재생 속도를 조절합니다. Walk/Run은 발 주기를 맞춰 섞습니다.

선택값은 기존 `src/api/client.js`의 `getPlayerCharacter`, `setPlayerCharacter`를 통해 기존 mock DB의 `playerCharacters[userId]`에 저장됩니다. 계정마다 따로 유지되며 기존 스탬프·쿠폰 데이터를 보존합니다. 현재는 사용자 요청에 따라 **localStorage 기반 로컬 연동**입니다. 원격 Supabase나 운영 서버에는 변경하지 않았습니다. 모델 로딩 실패 시 대체 모형을 표시해 물리와 게임 화면을 유지합니다.

## 재생성

Blender 4.5.3 LTS로 실행했습니다. 원본 경로는 `scripts/characters/preview_sources.py`, `build_characters.py`에서 지정합니다.

```powershell
blender --background --python scripts/characters/preview_sources.py
blender --background --python scripts/characters/build_characters.py
blender --background --python scripts/characters/package_editable.py
```

원본 FBX를 `.tmp/characters`에 복사하고 정규화한 뒤, 골격·웨이트·애니메이션을 생성하여 게임용 GLB와 편집용 Blender 파일을 내보냅니다. `.tmp`는 버전 관리에서 제외합니다.

## 검증

`frontend`에서 실행:

```powershell
node --test tests/*.test.mjs
npm run build
```

5개 테스트 통과: 사용자별 선택 저장·잘못된 ID 거부·기존 데이터 보존, GLB의 뼈대와 내장 텍스처, 웨이트 합계, 동작 길이, 반복 경계, Three.js로 각 동작 24지점의 변형 범위·바닥 관통·이동 방향 확인. 남녀의 Idle/Walk/Run 샘플 렌더도 확인했습니다.

제한: 실제 브라우저에서 조작하며 확인하는 검증은 컴퓨터 사용 도구가 현재 URL을 확인하지 못해 중단됐습니다. 빌드·자산 로딩·수치 검증과 Blender 렌더 검증 결과와 구분합니다. 기존 대형 프런트엔드 번들의 용량 경고는 빌드 오류가 아닙니다.

## 벤치 앉기

Stand To Sit.fbx를 Sit 클립(약 2.23초)으로 추가했습니다. JM 구역 벤치 앞에서 E로 앉고, E 또는 ESC로 일어납니다. 앉은 자세는 끝 프레임을 유지하며, 일어나기는 같은 클립을 역재생합니다.
