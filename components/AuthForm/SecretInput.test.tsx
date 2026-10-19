import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SecretInput from './SecretInput';

describe('secret field visibility', () => {
  it('toggles visibility without changing the value or submitting the form', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());

    render(
      <form onSubmit={onSubmit}>
        <label htmlFor="password">Password</label>
        <SecretInput
          id="password"
          name="password"
          secretLabel="password"
          autoComplete="current-password"
        />
      </form>
    );

    const input = screen.getByLabelText('Password');

    expect(input).toHaveAttribute('type', 'password');

    await user.type(input, 'test-password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));

    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveValue('test-password');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(input).toHaveAttribute('autoComplete', 'current-password');

    await user.click(screen.getByRole('button', { name: 'Hide password' }));

    expect(input).toHaveAttribute('type', 'password');
    expect(input).toHaveValue('test-password');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keeps password and passcode visibility independent', () => {
    render(
      <>
        <label htmlFor="passcode">App passcode</label>
        <SecretInput id="passcode" name="passcode" secretLabel="app passcode" />
        <label htmlFor="password">Password</label>
        <SecretInput id="password" name="password" secretLabel="password" />
      </>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Show app passcode' }));

    expect(screen.getByLabelText('App passcode')).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
  });

  it('inherits disabled state from the auth fieldset', async () => {
    render(
      <fieldset disabled>
        <label htmlFor="password">Password</label>
        <SecretInput id="password" name="password" secretLabel="password" />
      </fieldset>
    );

    expect(screen.getByRole('button', { name: 'Show password' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));

    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
  });
});
