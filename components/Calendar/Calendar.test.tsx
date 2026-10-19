import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { markAllNotificationsRead, markNotificationRead } from '@/app/library-actions';
import { defaultProfile } from '@/lib/library';
import type { NotificationRow } from '@/types/library';
import Calendar from './Calendar';

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock('@/app/library-actions', () => ({
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
}));
const notifications: NotificationRow[] = [null, null, '2026-10-18T10:00:00Z'].map(
  (read_at, index) => ({
    id: `notification-${index}`,
    member_id: 'owner',
    item_id: `item-${index}`,
    title: `Release ${index}`,
    delivery_key: `key-${index}`,
    created_at: '2026-10-18T09:00:00Z',
    read_at,
  })
);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(markAllNotificationsRead).mockResolvedValue({});
  vi.mocked(markNotificationRead).mockResolvedValue({});
});
function inbox(rows = notifications) {
  render(<Calendar items={[]} notifications={rows} profile={defaultProfile('owner')} />);
}
it('marks all unread notifications and updates the badge immediately after success', async () => {
  inbox();
  expect(screen.getByText('2 unread')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Mark all as read' }));
  await waitFor(() => expect(screen.getByText('0 unread')).toBeInTheDocument());
  expect(markAllNotificationsRead).toHaveBeenCalledOnce();
  expect(markNotificationRead).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Mark read' })).not.toBeInTheDocument();
  expect(mocks.refresh).toHaveBeenCalledOnce();
});
it('retains unread notifications on failure and permits retry', async () => {
  vi.mocked(markAllNotificationsRead).mockResolvedValueOnce({ error: 'Could not mark all read.' });
  inbox();
  fireEvent.click(screen.getByRole('button', { name: 'Mark all as read' }));
  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent('Could not mark all read.')
  );
  expect(screen.getByText('2 unread')).toBeInTheDocument();
  const retry = screen.getByRole('button', { name: 'Mark all as read' });
  await waitFor(() => expect(retry).toBeEnabled());
  fireEvent.click(retry);
  await waitFor(() => expect(screen.getByText('0 unread')).toBeInTheDocument());
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
it('disables read actions while saving and preserves individual marking', async () => {
  let complete!: (result: { error?: string }) => void;
  vi.mocked(markNotificationRead).mockReturnValueOnce(
    new Promise((resolve) => {
      complete = resolve;
    })
  );
  inbox();
  fireEvent.click(screen.getAllByRole('button', { name: 'Mark read' })[0]);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Mark all as read' })).toBeDisabled()
  );
  expect(
    screen
      .getAllByRole('button', { name: 'Mark read' })
      .every((button) => (button as HTMLButtonElement).disabled)
  ).toBe(true);
  complete({});
  await waitFor(() => expect(screen.getByText('1 unread')).toBeInTheDocument());
  expect(markNotificationRead).toHaveBeenCalledWith('notification-0');
  expect(markAllNotificationsRead).not.toHaveBeenCalled();
});
it.each([
  { rows: [] },
  { rows: notifications.map((n) => ({ ...n, read_at: '2026-10-18T10:00:00Z' })) },
])('hides the bulk read action for an empty or fully read inbox', ({ rows }) => {
  inbox(rows);
  expect(screen.queryByRole('button', { name: 'Mark all as read' })).not.toBeInTheDocument();
  expect(screen.getByText('0 unread')).toBeInTheDocument();
});
