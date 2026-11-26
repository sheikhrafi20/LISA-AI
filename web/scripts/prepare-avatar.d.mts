export const EYE_LOOK_DEGREES: number
export const PARTS: string[]
export const KEY_TARGETS: string[]

export interface AvatarReport {
  path: string
  parts: Record<string, { node: string; triangles: number; morphTargets: number }>
  bodyTargets: string[]
  eyeTargets: string[]
  triangles: number
  problems: string[]
}

export function prepare(inputPath: string, outputPath: string, log?: (message: string) => void): Promise<AvatarReport>
export function verify(path: string, log?: (message: string) => void): Promise<AvatarReport>
