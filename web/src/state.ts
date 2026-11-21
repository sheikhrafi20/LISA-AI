export type LisaState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error'

export const STATES: LisaState[] = ['idle', 'listening', 'processing', 'speaking', 'error']

export const STATE_COPY: Record<LisaState, { label: string; hint: string }> = {
  idle: { label: 'Ready', hint: 'Tap the microphone or type to talk to LISA' },
  listening: { label: 'Listening…', hint: 'Speak naturally. LISA is listening' },
  processing: { label: 'Thinking…', hint: 'LISA is preparing a reply' },
  speaking: { label: 'Speaking', hint: 'Tap stop to interrupt' },
  error: { label: 'Something went wrong', hint: 'Check your connection and try again' },
}
