// (담당: 병관) 골목 편지의 비공개 단서, 정답 판정과 두 사람의 재도전
import { randomInt, randomUUID } from 'node:crypto'
import { LETTER_COLORS, LETTER_ENDINGS, LETTER_ROLES, LETTER_STATIONS, LETTER_STATION_RADIUS, LETTER_SYMBOLS } from '../../shared/bk_letterPuzzle.js'

function permutations([first, ...rest]) {
  if (first === undefined) return [[]]
  return permutations(rest).flatMap((items) =>
    Array.from({ length: items.length + 1 }, (_, i) => [...items.slice(0, i), first, ...items.slice(i)]))
}

const symbolOrders = permutations(Object.keys(LETTER_SYMBOLS))
const symbolKeys = Object.keys(LETTER_SYMBOLS)
const colorOrders = permutations(Object.keys(LETTER_COLORS))
const sameOrder = (a, b) => a.every((value, i) => value === b[i])
const pick = (values) => values[randomInt(values.length)]

export function startLetterRound(previous) {
  const sequence = pick(previous ? symbolOrders.filter((value) => !sameOrder(value, previous.sequence)) : symbolOrders)
  const mappings = colorOrders
    .map((values) => Object.fromEntries(symbolKeys.map((key, i) => [key, values[i]])))
    .filter((mapping) => !previous || (
      !sameOrder(symbolKeys.map((key) => mapping[key]), symbolKeys.map((key) => previous.palette[key]))
      && !sameOrder(sequence.map((key) => mapping[key]), previous.answer)
    ))
  const palette = pick(mappings)
  return {
    id: randomUUID(), reverse: previous ? !previous.reverse : false, sequence, palette,
    answer: sequence.map((key) => palette[key]), read: new Set(), shared: new Set(), restart: new Set(),
    attempts: 0, solved: false,
    ending: previous ? (previous.ending + 1 + randomInt(LETTER_ENDINGS.length - 1)) % LETTER_ENDINGS.length : randomInt(LETTER_ENDINGS.length),
  }
}

function roleAt(round, index) {
  return LETTER_ROLES[round.reverse ? 1 - index : index]
}

export function letterSnapshot(round, index) {
  const role = roleAt(round, index)
  const partner = roleAt(round, 1 - index)
  const bothRead = LETTER_ROLES.every((key) => round.read.has(key))
  return {
    roundId: round.id, role, bothRead, attempts: round.attempts, solved: round.solved,
    partnerRead: round.read.has(partner), shared: round.shared.has(role),
    wantsReplay: round.restart.has(role), partnerWantsReplay: round.restart.has(partner),
    ...(round.read.has(role) && { clue: round[role] }),
    ...(round.shared.has(partner) && { received: round[partner] }),
    ...(round.solved && { ending: round.ending }),
  }
}

function atStation(peer, role) {
  if (!peer.state) return false
  const [x, y, z] = peer.state
  const [sx, sz] = LETTER_STATIONS[role].point
  return y >= -0.5 && y <= 3.5 && Math.hypot(x - sx, z - sz) <= LETTER_STATION_RADIUS
}

export function applyLetterAction(round, index, peer, msg) {
  if (msg.roundId !== round.id) return {}
  const role = roleAt(round, index)
  if (msg.t === 'episode.letter.read' && !round.solved && !round.read.has(role)) {
    if (!atStation(peer, role)) return { error: 'letter_station' }
    round.read.add(role)
    return { changed: true }
  }
  if (msg.t === 'episode.letter.share' && round.read.has(role) && !round.shared.has(role) && !round.solved) {
    round.shared.add(role)
    return { changed: true }
  }
  if (msg.t === 'episode.letter.guess' && !round.solved && role === 'palette' && round.read.size === 2) {
    if (round.shared.size !== LETTER_ROLES.length) return { error: 'letter_share' }
    if (!atStation(peer, role)) return { error: 'letter_station' }
    const { colors, attempt } = msg
    if (attempt !== undefined && attempt !== round.attempts) return {}
    if (!Array.isArray(colors) || colors.length !== 3 || new Set(colors).size !== 3 ||
      !colors.every((value) => typeof value === 'string' && Object.hasOwn(LETTER_COLORS, value))) return {}
    round.solved = sameOrder(round.answer, colors)
    if (!round.solved) round.attempts += 1
    return { changed: true }
  }
  if (msg.t === 'episode.letter.replay' && round.solved && !round.restart.has(role)) {
    round.restart.add(role)
    return { changed: true, replay: round.restart.size === 2 }
  }
  return {}
}
