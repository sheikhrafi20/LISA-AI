import { renderHook } from '@testing-library/react'
import { useGazeTracking } from './useGazeTracking'

const move = (x: number, y: number) =>
  window.dispatchEvent(new MouseEvent('pointermove', { clientX: x, clientY: y }))

describe('useGazeTracking', () => {
  afterEach(() => vi.useRealTimers())

  it('maps the pointer position to -1..1 with the centre at 0 and up positive', () => {
    const gaze = { current: { x: 0, y: 0 } }
    renderHook(() => useGazeTracking(gaze))
    const w = window.innerWidth
    const h = window.innerHeight
    move(w / 2, h / 2)
    expect(gaze.current.x).toBeCloseTo(0)
    expect(gaze.current.y).toBeCloseTo(0)
    move(w, 0)
    expect(gaze.current).toEqual({ x: 1, y: 1 })
    move(0, h)
    expect(gaze.current).toEqual({ x: -1, y: -1 })
  })

  it('clamps pointer positions outside the window', () => {
    const gaze = { current: { x: 0, y: 0 } }
    renderHook(() => useGazeTracking(gaze))
    move(window.innerWidth * 3, -500)
    expect(gaze.current).toEqual({ x: 1, y: 1 })
  })

  it('returns to the centre after the idle time', () => {
    vi.useFakeTimers()
    const gaze = { current: { x: 0, y: 0 } }
    renderHook(() => useGazeTracking(gaze, 1000))
    move(window.innerWidth, 0)
    expect(gaze.current.x).toBe(1)
    vi.advanceTimersByTime(1001)
    expect(gaze.current).toEqual({ x: 0, y: 0 })
  })

  it('stops listening when unmounted', () => {
    const gaze = { current: { x: 0, y: 0 } }
    const { unmount } = renderHook(() => useGazeTracking(gaze))
    unmount()
    move(window.innerWidth, 0)
    expect(gaze.current).toEqual({ x: 0, y: 0 })
  })
})
