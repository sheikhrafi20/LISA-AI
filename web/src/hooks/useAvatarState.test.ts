import { renderHook, act } from '@testing-library/react'
import { STATES } from '../state'
import type { AvatarEvent, LisaState } from '../types/avatar'
import { reducer, transition, useAvatarState } from './useAvatarState'

const EVENTS: AvatarEvent[] = ['START_LISTENING', 'STOP_LISTENING', 'SUBMIT', 'SPEAK_START', 'SPEAK_END', 'STOP_SPEAKING', 'CANCEL', 'ERROR', 'RESET']

describe('avatar state machine', () => {
  it.each<[LisaState, AvatarEvent, LisaState]>([
    ['idle', 'START_LISTENING', 'listening'],
    ['idle', 'SUBMIT', 'processing'],
    ['listening', 'STOP_LISTENING', 'idle'],
    ['listening', 'SUBMIT', 'processing'],
    ['processing', 'SPEAK_START', 'speaking'],
    ['processing', 'CANCEL', 'idle'],
    ['speaking', 'SPEAK_END', 'idle'],
    ['speaking', 'STOP_SPEAKING', 'idle'],
    ['speaking', 'START_LISTENING', 'listening'],
    ['error', 'RESET', 'idle'],
    ['error', 'START_LISTENING', 'listening'],
  ])('%s + %s -> %s', (from, event, to) => {
    expect(transition(from, event)).toBe(to)
  })

  it('ERROR leads to the error state from every other state', () => {
    for (const s of STATES.filter((x) => x !== 'error')) expect(transition(s, 'ERROR')).toBe('error')
  })

  it('ignores events that make no sense in the current state', () => {
    expect(transition('idle', 'STOP_SPEAKING')).toBe('idle')
    expect(transition('idle', 'SPEAK_END')).toBe('idle')
    expect(transition('listening', 'SPEAK_START')).toBe('listening')
    expect(transition('error', 'STOP_LISTENING')).toBe('error')
  })

  it('every transition lands on a real state', () => {
    for (const s of STATES) for (const e of EVENTS) expect(STATES).toContain(transition(s, e))
  })

  it('keeps the same object for ignored events and stores the error message', () => {
    const idle = { state: 'idle' as const, error: null }
    expect(reducer(idle, { type: 'STOP_SPEAKING' })).toBe(idle)
    const failed = reducer(idle, { type: 'ERROR', message: 'Microphone blocked' })
    expect(failed).toEqual({ state: 'error', error: 'Microphone blocked' })
    expect(reducer(failed, { type: 'ERROR', message: 'Second problem' }).error).toBe('Second problem')
    expect(reducer(failed, { type: 'RESET' })).toEqual({ state: 'idle', error: null })
  })

  it('works as a hook', () => {
    const { result } = renderHook(() => useAvatarState())
    expect(result.current.state).toBe('idle')
    act(() => result.current.send('START_LISTENING'))
    expect(result.current.state).toBe('listening')
    act(() => result.current.send('SUBMIT'))
    act(() => result.current.send('SPEAK_START'))
    expect(result.current.state).toBe('speaking')
    act(() => result.current.send('ERROR', 'Network down'))
    expect(result.current.state).toBe('error')
    expect(result.current.error).toBe('Network down')
    act(() => result.current.force('idle'))
    expect(result.current.state).toBe('idle')
  })
})
