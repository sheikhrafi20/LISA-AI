import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

const status = () => screen.getByTestId('status')
const preview = (name: RegExp) => userEvent.click(screen.getByRole('button', { name }))

describe('LISA UI (Phase 1)', () => {
  it('starts in the idle state', () => {
    render(<App />)
    expect(status()).toHaveTextContent('Ready')
    expect(screen.getByRole('main')).toHaveAttribute('data-state', 'idle')
    expect(screen.getByRole('heading', { name: 'LISA' })).toBeInTheDocument()
  })

  it.each([
    [/^listening$/i, 'listening', 'Listening…'],
    [/^processing$/i, 'processing', 'Thinking…'],
    [/^speaking$/i, 'speaking', 'Speaking'],
    [/^error$/i, 'error', 'Something went wrong'],
  ])('shows the %s state', async (name, state, text) => {
    render(<App />)
    await preview(name)
    expect(screen.getByRole('main')).toHaveAttribute('data-state', state)
    expect(status()).toHaveTextContent(text)
    expect(screen.getByTestId('stage')).toHaveAttribute('data-stage-state', state)
    expect(screen.getByTestId('waveform')).toHaveAttribute('data-state-view', state)
  })

  it('shows the stop button only while speaking, and stop returns to idle', async () => {
    render(<App />)
    expect(screen.queryByRole('button', { name: 'Stop speaking' })).not.toBeInTheDocument()
    await preview(/^speaking$/i)
    await userEvent.click(screen.getByRole('button', { name: 'Stop speaking' }))
    expect(screen.getByRole('main')).toHaveAttribute('data-state', 'idle')
    expect(screen.queryByRole('button', { name: 'Stop speaking' })).not.toBeInTheDocument()
  })

  it('is honest that voice and chat are not connected yet', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Start voice input' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Phase 4')
    await userEvent.type(screen.getByLabelText('Message'), 'hello{Enter}')
    expect(await screen.findByText(/Phase 5/)).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveAttribute('data-state', 'idle')
  })

  it('opens and closes settings (button, Escape)', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Open settings' }))
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: 'Open settings' }))
    await userEvent.click(screen.getByRole('button', { name: 'Close settings' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('saves settings on this device and applies reduce motion', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Open settings' }))
    await userEvent.selectOptions(screen.getByLabelText('AI model'), 'claude-sonnet-5-5')
    await userEvent.click(screen.getByLabelText('Reduce motion'))
    expect(screen.getByRole('main')).toHaveAttribute('data-motion', 'reduced')
    const saved = JSON.parse(localStorage.getItem('lisa.settings.v1') ?? '{}')
    expect(saved).toMatchObject({ model: 'claude-sonnet-5-5', reduceMotion: true })
  })

  it('ignores corrupted saved settings', () => {
    localStorage.setItem('lisa.settings.v1', '{not json')
    render(<App />)
    expect(screen.getByRole('main')).toHaveAttribute('data-motion', 'full')
  })
})
