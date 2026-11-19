import { useEffect } from 'react'
import { create } from 'zustand'
import characters from '@shared/characters.json'
import { getPlayerCharacter, setPlayerCharacter } from '../../api/client.js'
import { useUiStore } from '../../components/movieZone/uiStore.js'

export { characters }
const pending = new Map()
export const useCharacterStore = create((set, get) => ({
  byUser: {},
  busy: {},
  errors: {},
  load(userId) {
    if (get().byUser[userId] || pending.has(userId)) return
    const request = getPlayerCharacter({ userId }).then(({ character }) => {
      set(state => ({ byUser: { ...state.byUser, [userId]: character } }))
    }).catch(error => {
      set(state => ({ errors: { ...state.errors, [userId]: error.message } }))
    }).finally(() => pending.delete(userId))
    pending.set(userId, request)
  },
  async choose(userId, characterId) {
    if (get().busy[userId]) return
    set(state => ({ busy: { ...state.busy, [userId]: true }, errors: { ...state.errors, [userId]: null } }))
    try {
      await pending.get(userId)
      const { character } = await setPlayerCharacter({ userId, characterId })
      set(state => ({ byUser: { ...state.byUser, [userId]: character } }))
    } catch (error) {
      set(state => ({ errors: { ...state.errors, [userId]: error.message } }))
    } finally {
      set(state => ({ busy: { ...state.busy, [userId]: false } }))
    }
  },
}))

export function usePlayerCharacter() {
  const userId = useUiStore(state => state.userId)
  const character = useCharacterStore(state => state.byUser[userId] ?? characters[0])
  const busy = useCharacterStore(state => !!state.busy[userId])
  const error = useCharacterStore(state => state.errors[userId])
  useEffect(() => { useCharacterStore.getState().load(userId) }, [userId])
  return { character, busy, error, choose: id => useCharacterStore.getState().choose(userId, id) }
}
