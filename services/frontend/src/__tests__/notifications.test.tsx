import { render, screen, act } from '@testing-library/react'
import { NotificationProvider, useNotifications } from '@/lib/notifications'

// Suppress audio/vibrate in test environment
jest.mock('@/lib/sounds', () => ({
  notificationFeedback: {
    bid:     jest.fn(),
    won:     jest.fn(),
    settled: jest.fn(),
  },
}))

function TestConsumer() {
  const { notifications, unreadCount, addNotification, markAllRead, clearAll } = useNotifications()
  return (
    <div>
      <span data-testid="count">{unreadCount}</span>
      <span data-testid="total">{notifications.length}</span>
      <button
        onClick={() => addNotification({ type: 'bid', title: 'Test bid', message: 'Someone bid' })}
        data-testid="add-bid"
      >
        Add bid
      </button>
      <button onClick={markAllRead} data-testid="mark-read">Mark read</button>
      <button onClick={clearAll}    data-testid="clear">Clear</button>
    </div>
  )
}

describe('NotificationProvider', () => {
  it('starts with zero notifications', () => {
    render(<NotificationProvider><TestConsumer /></NotificationProvider>)
    expect(screen.getByTestId('count').textContent).toBe('0')
    expect(screen.getByTestId('total').textContent).toBe('0')
  })

  it('adds notification and increments unread count', async () => {
    render(<NotificationProvider><TestConsumer /></NotificationProvider>)
    await act(async () => { screen.getByTestId('add-bid').click() })
    expect(screen.getByTestId('count').textContent).toBe('1')
    expect(screen.getByTestId('total').textContent).toBe('1')
  })

  it('markAllRead sets unread count to 0', async () => {
    render(<NotificationProvider><TestConsumer /></NotificationProvider>)
    await act(async () => { screen.getByTestId('add-bid').click() })
    await act(async () => { screen.getByTestId('mark-read').click() })
    expect(screen.getByTestId('count').textContent).toBe('0')
    expect(screen.getByTestId('total').textContent).toBe('1')
  })

  it('clearAll removes all notifications', async () => {
    render(<NotificationProvider><TestConsumer /></NotificationProvider>)
    await act(async () => { screen.getByTestId('add-bid').click() })
    await act(async () => { screen.getByTestId('clear').click() })
    expect(screen.getByTestId('total').textContent).toBe('0')
  })

  it('adding multiple notifications accumulates count', async () => {
    render(<NotificationProvider><TestConsumer /></NotificationProvider>)
    await act(async () => { screen.getByTestId('add-bid').click() })
    await act(async () => { screen.getByTestId('add-bid').click() })
    expect(screen.getByTestId('count').textContent).toBe('2')
  })
})
