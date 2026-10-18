import { parseNotes } from './import';
import { EMPTY_FIELDS } from './library';

describe('notes import', () => {
  it('recognises status headings and leaves question-mark titles ambiguous', () => {
    const rows = parseNotes(
      'Games\nAnticipated Game Titles\n• Kemuri?\n• Kingdom Hearts 4\nPlaying now\n• Hades II'
    );
    expect(rows.map((r) => [r.title, r.kind, r.status, r.ambiguous])).toEqual([
      ['Kemuri?', 'game', 'anticipated', true],
      ['Kingdom Hearts 4', 'game', 'anticipated', false],
      ['Hades II', 'game', 'playing', false],
    ]);
  });
  it('handles inline movie services, case-insensitive TV headings, and Outlook footers', () => {
    const rows = parseNotes(
      '• Fair play -Netflix\n• Nocturnal Animals\n• Coda - Apple TV\nHBO\n• Lanterns\nPRIME\n• Vanished\nSent from Outlook for Android'
    );
    expect(rows).toHaveLength(5);
    expect(rows.map((r) => [r.title, r.kind, r.services])).toEqual([
      ['Fair play', 'movie', ['Netflix']],
      ['Nocturnal Animals', 'movie', []],
      ['Coda', 'movie', ['Apple TV']],
      ['Lanterns', 'show', ['HBO']],
      ['Vanished', 'show', ['Prime Video']],
    ]);
  });
  it('keeps date hints without guessing release years and interprets Out/Re prefixes', () => {
    const rows = parseNotes(
      'Games\nScheduled Release Calendar\n• November 19th GTA VI\nAvailable and Replay Titles\n• Out Wolverine\n• Re Super Mario Odyssey\n• Re: Xenoblade 2'
    );
    expect(rows[0]).toMatchObject({
      title: 'GTA VI',
      date_hint: 'November 19th',
      status: 'scheduled',
    });
    expect(rows.slice(1).map((r) => [r.title, r.status, r.ambiguous])).toEqual([
      ['Wolverine', 'backlog', false],
      ['Super Mario Odyssey', 'replay', false],
      ['Xenoblade 2', 'replay', false],
    ]);
  });
  it('flags duplicates within a paste and existing library, keeping different types distinct', () => {
    const rows = parseNotes('Games\n• Hades II\n• Hades II\nMovies\n• Hades II', [
      { kind: 'game', fields: { ...EMPTY_FIELDS, title: 'Hades II' } },
    ]);
    expect(rows.map((r) => r.duplicate)).toEqual([true, true, false]);
  });
  it('does not infer types below unknown headings', () => {
    expect(parseNotes('Mystery:\n• Something')[0]).toMatchObject({ kind: null, ambiguous: true });
  });
});
