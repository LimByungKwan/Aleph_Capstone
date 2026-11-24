// (담당: 병관) 주간 데이트 에피소드의 이야기, 순서, 저장할 엔딩 엽서
import { episodeSteps } from '@shared/bk_episodeSteps.js'

const stepText = {
  cafe: '소란 커피에서 함께 마시고 싶은 음료와 디저트를 골라요.',
  mural: '날개 벽화 앞에서 쪽지의 주인공을 떠올리며 엔딩 구도를 완성해요.',
  photo: '커플 포토존에서 혼자 또는 친구와 인생네컷을 완성해요.',
  telescope: '별빛 전망대의 망원경으로 멀리 있는 명소 하나를 찾아요.',
}

const stepsFor = (episodeId) => episodeSteps(episodeId).map((id) => ({ id, text: stepText[id] }))

export const DATE_EPISODES = [
  {
    id: 'alley',
    title: '골목 끝에서 기다릴게',
    intro: '소란 커피의 창가에 작은 쪽지가 놓여 있어요. “좋아할 만한 걸 골라 줘. 골목 끝에서 기다릴게.”',
    steps: stepsFor('alley'),
    lines: ['다음에도 이 골목에서 만나자.', '오늘을 오래 기억할 것 같아.'],
  },
  {
    id: 'starlight',
    title: '별빛이 남긴 사진',
    intro: '사진관에 남겨진 필름 봉투에는 전망대에서 마지막 장면을 찾아 달라는 부탁이 적혀 있어요.',
    steps: stepsFor('starlight'),
    lines: ['같이 본 풍경은 더 오래 남아.', '다음 사진도 여기서 찍자.'],
  },
]

const FIRST_MONDAY = Date.UTC(2026, 10, 23)
const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const KST_MS = 9 * 60 * 60 * 1000

export function featuredDateEpisode(now = Date.now()) {
  const week = Math.max(0, Math.floor((now + KST_MS - FIRST_MONDAY) / WEEK_MS))
  return DATE_EPISODES[week % DATE_EPISODES.length]
}

export const EMPTY_EPISODE_BOOK = { currentId: null, runs: {}, postcards: {} }
export const getDateEpisode = (id) => DATE_EPISODES.find((episode) => episode.id === id)

export function currentEpisodeStep(book) {
  const episode = getDateEpisode(book?.currentId)
  const run = book?.runs[book.currentId]
  return run && episode?.steps[run.step]
}

export function recordEpisodeActivity(book, activity, order) {
  if (currentEpisodeStep(book)?.id !== activity) return book
  const id = book.currentId
  const run = book.runs[id]
  return { ...book, runs: { ...book.runs, [id]: { ...run, step: run.step + 1, ...(activity === 'cafe' && { order }) } } }
}

export function collectEpisodePostcard(book, id, line, savedAt) {
  const episode = getDateEpisode(id)
  const run = book?.runs[id]
  if (!episode?.lines.includes(line) || !run || run.step !== episode.steps.length) return book
  const runs = { ...book.runs }
  delete runs[id]
  return {
    ...book,
    currentId: book.currentId === id ? null : book.currentId,
    runs,
    postcards: { ...book.postcards, [id]: { line, savedAt, ...(run.order && { order: run.order }) } },
  }
}
