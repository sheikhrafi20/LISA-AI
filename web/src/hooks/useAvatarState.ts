import { useCallback, useReducer } from 'react'
import type { AvatarEvent, AvatarMachine, LisaState } from '../types/avatar'

/**
 * The avatar state machine. It knows nothing about rendering: the 3D scene, the
 * interface and the voice code all just read the state and send events.
 */
const TABLE: Record<LisaState, Partial<Record<AvatarEvent, LisaState>>> = {
  idle: { START_LISTENING: 'listening', SUBMIT: 'processing', SPEAK_START: 'speaking', ERROR: 'error' },
  listening: { STOP_LISTENING: 'idle', CANCEL: 'idle', SUBMIT: 'processing', ERROR: 'error' },
  processing: { SPEAK_START: 'speaking', SPEAK_END: 'idle', CANCEL: 'idle', ERROR: 'error' },
  speaking: { SPEAK_END: 'idle', STOP_SPEAKING: 'idle', CANCEL: 'idle', START_LISTENING: 'listening', ERROR: 'error' },
  error: { RESET: 'idle', START_LISTENING: 'listening', SUBMIT: 'processing' },
}

/** The next state, or the same state if the event is not allowed right now. */
export function transition(state: LisaState, event: AvatarEvent): LisaState {
  return TABLE[state][event] ?? state
}

type Action = { type: AvatarEvent; message?: string } | { type: 'FORCE'; state: LisaState }

export function reducer(machine: AvatarMachine, action: Action): AvatarMachine {
  if (action.type === 'FORCE') {
    return { state: action.state, error: action.state === 'error' ? 'Preview of the error state' : null }
  }
  const next = transition(machine.state, action.type)
  // An ERROR while already in error still refreshes the message; other ignored events change nothing.
  if (next === machine.state && action.type !== 'ERROR') return machine
  return { state: next, error: next === 'error' ? (action.message ?? 'Something went wrong') : null }
}

export function useAvatarState(initial: LisaState = 'idle') {
  const [machine, dispatch] = useReducer(reducer, { state: initial, error: null })
  const send = useCallback((type: AvatarEvent, message?: string) => dispatch({ type, message }), [])
  /** For the development preview strip and tests only: jumps straight to a state. */
  const force = useCallback((state: LisaState) => dispatch({ type: 'FORCE', state }), [])
  return { state: machine.state, error: machine.error, send, force }
}
