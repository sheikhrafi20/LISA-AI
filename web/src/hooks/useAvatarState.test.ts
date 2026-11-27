import { act, renderHook } from '@testing-library/react'
import { reducer, transition, useAvatarState } from './useAvatarState'
import type { AvatarEvent, LisaState } from '../types/avatar'

const start = { state: 'idle' as LisaState, error: null }

describe('avatar state machine', () => {
  it.each<[LisaState, AvatarEvent, LisaState]>([
    ['idle', 'START_LISTENING', 'listening'],
    ['idle', 'SUBMIT', 'processing'],
    ['listening', 'STOP_LISTENING', 'idle'],
    ['listening', 'SUBMIT', 'processing'],
    ['listening', 'CANCEL', 'idle'],
    ['processing', 'SPEAK_START', 'speaking'],
    ['processing', 'SPEAK_END', 'idle'],
    ['processing', 'CANCEL', 'idle'],
    ['speaking', 'SPEAK_END', 'idle'],
    ['speaking', 'STOP_SPEAKING', 'idle'],
    ['speaking', 'START_LISTENING', 'listening'],
    ['error', 'RESET', 'idle'],
    ['error', 'START_LISTENING', 'listening'],
    ['error', 'SUBMIT', 'processing'],
  ])('%s + %s -> %s', (from, event, to) => {
    expect(transition(from, event)).toBe(to)
  })

  it.each<[LisaState, AvatarEvent]>([
    ['idle', 'SPEAK_END'],
    ['idle', 'STOP_LISTENING'],
    ['listening', 'SPEAK_START'],
    ['processing', 'START_LISTENING'],
    ['processing', 'STOP_SPEAKING'],
    ['speaking', 'SUBMIT'],
    ['error', 'SPEAK_START'],
  ])('ignores %s + %s', (from, event) => {
    expect(transition(from, event)).toBe(from)
  })

  it('every state can reach the error state and recover from it', () => {
    for (const s of ['idle', 'listening', 'processing', 'speaking'] as LisaState[]) {
      const failed = reducer({ state: s, error: null }, { type: 'ERROR', message: 'boom' })
      expect(failed).toEqual({ state: 'error', error: 'boom' })
      expect(reducer(failed, { type: 'RESET' })).toEqual({ state: 'idle', error: null })
    }
  })

  it('uses a default message and updates it on a repeated error', () => {
    const first = reducer(start, { type: 'ERROR' })
    expect(first.error).toBe('Something went wrong')
    expect(reducer(first, { type: 'ERROR', message: 'second' }).error).toBe('second')
  })

  it('returns the very same object for ignored events, so React does not re-render', () => {
    expect(reducer(start, { type: 'SPEAK_END' })).toBe(start)
  })

  it('clears the error message when leaving the error state', () => {
    const failed = reducer(start, { type: 'ERROR', message: 'x' })
    expect(reducer(failed, { type: 'START_LISTENING' }).error).toBeNull()
  })

  it('hook: a normal conversation goes idle > listening > processing > speaking > idle', () => {
    const { result } = renderHook(() => useAvatarState())
    const seen: LisaState[] = [result.current.state]
    for (const event of ['START_LISTENING', 'SUBMIT', 'SPEAK_START', 'SPEAK_END'] as AvatarEvent[]) {
      act(() => result.current.send(event))
      seen.push(result.current.state)
    }
    expect(seen).toEqual(['idle', 'listening', 'processing', 'speaking', 'idle'])
  })

  it('hook: force jumps to any state (development preview only)', () => {
    const { result } = renderHook(() => useAvatarState())
    act(() => result.current.force('speaking'))
    expect(result.current.state).toBe('speaking')
    act(() => result.current.force('error'))
    expect(result.current.error).not.toBeNull()
  })
})
