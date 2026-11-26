import { act, renderHook } from '@testing-library/react'
import { useGazeTracking } from './useGazeTracking'

describe('gaze tracking', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Object.defineProperty(window, 'innerWidth', { value: 1000, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })
  })
  afterEach(() => vi.useRealTimers())

  it('follows the pointer and comes back to the centre when idle', () => {
    const gaze = { current: { x: 0, y: 0 } }
    renderHook(() => useGazeTracking(gaze, 1000))
    act(() => { window.dispatchEvent(new MouseEvent('pointermove', { clientX: 1000, clientY: 0 })) })
    expect(gaze.current).toEqual({ x: 1, y: 1 }) // top right of the screen
    act(() => { window.dispatchEvent(new MouseEvent('pointermove', { clientX: 0, clientY: 800 })) })
    expect(gaze.current).toEqual({ x: -1, y: -1 }) // bottom left
    act(() => { vi.advanceTimersByTime(1100) })
    expect(gaze.current).toEqual({ x: 0, y: 0 })
  })

  it('stops listening after unmount', () => {
    const gaze = { current: { x: 0, y: 0 } }
    const { unmount } = renderHook(() => useGazeTracking(gaze))
    unmount()
    act(() => { window.dispatchEvent(new MouseEvent('pointermove', { clientX: 900, clientY: 100 })) })
    expect(gaze.current).toEqual({ x: 0, y: 0 })
  })
})
