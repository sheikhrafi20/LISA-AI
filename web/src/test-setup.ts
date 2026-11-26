import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Some test files run in a plain Node environment (no browser), where these do not exist.
afterEach(() => {
  if (typeof document !== 'undefined') cleanup()
  if (typeof localStorage !== 'undefined') localStorage.clear()
})
