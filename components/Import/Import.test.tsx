import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { defaultProfile } from '@/lib/library';
import Import from './Import';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/app/import-actions', () => ({ saveReviewedImport: vi.fn() }));
afterEach(() => vi.unstubAllGlobals());

it('parses notes locally and searches only the row requested by the user', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ results: [] }));
  vi.stubGlobal('fetch', fetch);
  render(<Import items={[]} profile={defaultProfile('owner')} />);
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Your notes'), {
    target: { value: 'Games\nAnticipated Game Titles\n• Hades\n• Fable' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Review titles' }));
  expect(screen.getByRole('heading', { name: '2 titles to review' })).toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
  const row = screen.getByDisplayValue('Hades').closest('section')!;
  fireEvent.change(within(row).getByLabelText('Title'), { target: { value: 'Hades II' } });
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(within(row).getByRole('button', { name: 'Find matches' }));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  expect(fetch).toHaveBeenCalledWith('/api/search?q=Hades%20II&kind=game');
  await waitFor(() =>
    expect(
      within(row).getByText('No match found. This title can be saved unmatched.')
    ).toBeInTheDocument()
  );
  expect(screen.getByDisplayValue('Fable')).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(1);
});
