import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import InstallApp from './InstallApp';

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  );
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    value: vi.fn(),
    configurable: true,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});

const offerInstall = (outcome: 'accepted' | 'dismissed' = 'accepted') => {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  const prompt = vi.fn().mockResolvedValue(undefined);

  Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome }) });

  act(() => {
    window.dispatchEvent(event);
  });

  return { event, prompt };
};

it('waits for browser install availability and invokes the native prompt on click', async () => {
  render(<InstallApp />);

  expect(screen.queryByRole('button', { name: 'Install Pixelar' })).not.toBeInTheDocument();

  const { event, prompt } = offerInstall();

  expect(event.defaultPrevented).toBe(true);
  expect(prompt).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'Install Pixelar' }));
  await waitFor(() => expect(prompt).toHaveBeenCalledTimes(1));
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Install Pixelar' })).not.toBeInTheDocument()
  );
});

it('discards a dismissed prompt rather than reusing it', async () => {
  render(<InstallApp />);

  offerInstall('dismissed');

  fireEvent.click(screen.getByRole('button', { name: 'Install Pixelar' }));
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Install Pixelar' })).not.toBeInTheDocument()
  );
});

it('hides the option after installation', () => {
  render(<InstallApp />);

  offerInstall();

  act(() => {
    window.dispatchEvent(new Event('appinstalled'));
  });

  expect(screen.queryByRole('button', { name: 'Install Pixelar' })).not.toBeInTheDocument();
});

it('does not offer installation in standalone mode', () => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: true }))
  );

  render(<InstallApp />);

  const { event } = offerInstall();

  expect(event.defaultPrevented).toBe(false);
  expect(screen.queryByRole('button', { name: 'Install Pixelar' })).not.toBeInTheDocument();
});

it('offers iPhone users the Add to Home Screen dialog', () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('iPhone Safari');

  const showModal = vi.fn();

  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    value: showModal,
    configurable: true,
  });

  render(<InstallApp />);
  fireEvent.click(screen.getByRole('button', { name: 'Install Pixelar' }));

  expect(showModal).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/Add to Home Screen/)).toBeInTheDocument();

  vi.restoreAllMocks();
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
});
