import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import SignInModal from './SignInModal';

const mocks = vi.hoisted(() => ({ params: 'signin=1', replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => new URLSearchParams(mocks.params),
}));
vi.mock('@/app/auth-actions', () => ({ loginWithCredentials: vi.fn(), registerAccount: vi.fn() }));

beforeEach(() => {
  mocks.params = 'signin=1';
  mocks.replace.mockClear();
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    },
  });
});
afterEach(() => {
  cleanup();
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});

it('opens an accessible sign-in dialog and focuses the login field', () => {
  const { rerender } = render(<SignInModal available />);
  const dialog = screen.getByRole('dialog', { name: 'Sign in' });
  expect(screen.getByLabelText('Username or email')).toHaveFocus();
  expect(document.body.style.overflow).toBe('hidden');
  expect(dialog).toContainElement(screen.getByRole('button', { name: 'Sign in' }));
  mocks.params = '';
  rerender(<SignInModal available />);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(document.body.style.overflow).toBe('');
});

it('closes through the close button and Escape without discarding other query parameters', () => {
  mocks.params = 'signin=1&ref=library';
  render(<SignInModal available />);
  fireEvent.click(screen.getByRole('button', { name: 'Close sign in' }));
  expect(mocks.replace).toHaveBeenLastCalledWith('/?ref=library', { scroll: false });
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
  expect(mocks.replace).toHaveBeenCalledTimes(2);
});

it('keeps authentication unavailable when server configuration is missing', () => {
  render(<SignInModal available={false} />);
  expect(screen.getByLabelText('Username or email')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent('Sign-in is currently unavailable.');
});
