import type { Mesh } from 'three'
import type { LisaState } from '../state'

export type { LisaState }

/** Morph target name to weight (0 to 1). */
export type Pose = Record<string, number>

export type AvatarEvent =
  | 'START_LISTENING'
  | 'STOP_LISTENING'
  | 'SUBMIT'
  | 'SPEAK_START'
  | 'SPEAK_END'
  | 'STOP_SPEAKING'
  | 'CANCEL'
  | 'ERROR'
  | 'RESET'

/** Where the avatar should look: x and y from -1 to 1 (right and up are positive on screen). */
export interface Gaze {
  x: number
  y: number
}

export interface AvatarMachine {
  state: LisaState
  error: string | null
}

export type MorphBindings = Map<string, Array<{ mesh: Mesh; index: number }>>

export interface MorphReport {
  /** Expected morph targets that the loaded model really has. */
  found: string[]
  /** Expected morph targets the model does NOT have (those channels are skipped, never faked). */
  missing: string[]
  /** Every morph target name found on the model. */
  all: string[]
}
