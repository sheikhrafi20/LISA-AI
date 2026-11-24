/** True only if this browser can create a WebGL context. Checked before any 3D code runs. */
export function isWebGLAvailable(): boolean {
  try {
    if (typeof window === 'undefined' || !('WebGLRenderingContext' in window)) return false
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

/** Phones and tablets get a lower pixel ratio to keep the frame rate smooth. */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 640
}
