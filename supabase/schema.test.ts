// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

let db: PGlite;

const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const item = '33333333-3333-4333-8333-333333333333';

const process = async (at: string, target: string | null = owner) => {
  return db.query('select public.pixelar_process_releases($1::uuid,$2::timestamptz) as sent', [
    target,
    at,
  ]);
};

const insert = async (
  overrides: Record<string, unknown> = {},
  status = 'scheduled',
  autoMove = true,
  kind = 'game'
) => {
  await db.query(
    'insert into pixelar_items(id,member_id,kind,status,overrides,auto_move) values($1,$2,$3,$4,$5,$6)',
    [
      item,
      owner,
      kind,
      status,
      JSON.stringify({
        title: 'Release title',
        release_precision: 'day',
        release_date: '2026-10-18',
        ...overrides,
      }),
      autoMove,
    ]
  );
  await db.query('insert into pixelar_reminders(item_id,member_id,days_before) values($1,$2,0)', [
    item,
    owner,
  ]);
};

const status = async () => {
  return (
    await db.query<{ status: string }>('select status from pixelar_items where id=$1', [item])
  ).rows[0].status;
};

const count = async () => {
  return (
    await db.query<{ count: number }>('select count(*)::int as count from pixelar_notifications')
  ).rows[0].count;
};

beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    "create role anon;create role authenticated;create role service_role;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id text,bucket_id text);alter table storage.objects enable row level security;grant select,insert on storage.objects to anon,authenticated;create policy test_existing_broad_policy on storage.objects for all to anon,authenticated using(true) with check(true);create table public.caelum_test_sentinel(id integer primary key,value text);insert into caelum_test_sentinel values(1,'untouched');"
  );

  const sql = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');

  await db.exec(sql);
  await db.exec(sql);
  await db.exec(
    await readFile(new URL('./migrations/20261019_shelf_layouts.sql', import.meta.url), 'utf8')
  );
  await db.exec(
    await readFile(new URL('./migrations/20261019_library_banners.sql', import.meta.url), 'utf8')
  );
}, 20000);

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await db.exec('truncate pixelar_members cascade');
  await db.query("insert into pixelar_members(id,name) values($1,'Owner'),($2,'Other')", [
    owner,
    other,
  ]);
});

describe('additive schema and ownership', () => {
  it('can be reapplied and leaves non-Pixelar objects unchanged', async () => {
    expect((await db.query('select * from caelum_test_sentinel')).rows).toEqual([
      { id: 1, value: 'untouched' },
    ]);
    expect(
      (
        await db.query<{ count: number }>(
          'select count(*)::int as count from pixelar_item_statuses'
        )
      ).rows[0].count
    ).toBe(17);
  });

  it('denies browser table access and release function execution', async () => {
    await db.exec('set role anon');

    await expect(db.query('select * from pixelar_items')).rejects.toThrow(/permission denied/);
    await expect(db.query('select pixelar_process_releases()')).rejects.toThrow(
      /permission denied/
    );
    await expect(
      db.query(
        'select pixelar_save_shelf_layout($1,\'games_status\',\'{"order":[],"collapsed":[]}\'::jsonb)',
        [owner]
      )
    ).rejects.toThrow(/permission denied/);

    await expect(db.query("select pixelar_save_banner($1,'game',null)", [owner])).rejects.toThrow(
      /permission denied/
    );

    await db.exec('reset role');

    const rows = await db.query<{ relrowsecurity: boolean }>(
      "select relrowsecurity from pg_class where relname in ('pixelar_items','pixelar_profiles','pixelar_metadata_cache','pixelar_reminders','pixelar_notifications','pixelar_item_statuses')"
    );

    expect(rows.rows).toHaveLength(6);
    expect(rows.rows.every((r) => r.relrowsecurity)).toBe(true);
  });

  it('updates shelf layouts atomically per owner and view without overwriting profile preferences', async () => {
    await db.query(
      "insert into pixelar_profiles(member_id,currency,avatar_path) values($1,'USD','owner/profile.webp'),($2,'EUR',null)",
      [owner, other]
    );

    const games = { order: ['Playing', 'Backlog'], collapsed: ['Anticipated'] };

    const tv = { order: ['Netflix', 'Prime Video'], collapsed: [] };

    await Promise.all([
      db.query('select pixelar_save_shelf_layout($1,$2,$3)', [
        owner,
        'games_status',
        JSON.stringify(games),
      ]),
      db.query('select pixelar_save_shelf_layout($1,$2,$3)', [
        owner,
        'tv_service',
        JSON.stringify(tv),
      ]),
    ]);

    const rows = await db.query<{
      currency: string;
      avatar_path: string | null;
      shelf_layouts: unknown;
    }>('select currency,avatar_path,shelf_layouts from pixelar_profiles where member_id=$1', [
      owner,
    ]);

    expect(rows.rows[0]).toEqual({
      currency: 'USD',
      avatar_path: 'owner/profile.webp',
      shelf_layouts: { games_status: games, tv_service: tv },
    });
    expect(
      (await db.query('select shelf_layouts from pixelar_profiles where member_id=$1', [other]))
        .rows
    ).toEqual([{ shelf_layouts: {} }]);
    await expect(
      db.query("select pixelar_save_shelf_layout($1,'invalid',$2)", [owner, JSON.stringify(games)])
    ).rejects.toThrow(/Invalid shelf/);
    await expect(
      db.query(
        'select pixelar_save_shelf_layout($1,\'games_status\',\'{"order":[123],"collapsed":[]}\'::jsonb)',
        [owner]
      )
    ).rejects.toThrow(/Invalid shelf/);
  });

  it('saves independent banners without changing profile settings or another owner’s selections', async () => {
    await insert({}, 'playing');
    await db.query(
      "insert into pixelar_items(id,member_id,kind,status) values($1,$2,'show','watching')",
      [other, owner]
    );
    await db.query(
      "insert into pixelar_profiles(member_id,currency,shelf_layouts) values($1,'USD',$2)",
      [owner, JSON.stringify({ games_status: { order: ['Playing'], collapsed: [] } })]
    );

    await Promise.all([
      db.query("select pixelar_save_banner($1,'game',$2)", [owner, item]),
      db.query("select pixelar_save_banner($1,'screen',$2)", [owner, other]),
    ]);

    expect(
      (
        await db.query(
          'select banner_items,currency,shelf_layouts from pixelar_profiles where member_id=$1',
          [owner]
        )
      ).rows
    ).toEqual([
      {
        banner_items: { game: item, screen: other },
        currency: 'USD',
        shelf_layouts: { games_status: { order: ['Playing'], collapsed: [] } },
      },
    ]);
    expect(
      (await db.query('select * from pixelar_profiles where member_id=$1', [other])).rows
    ).toEqual([]);

    await db.query("select pixelar_save_banner($1,'game',null)", [owner]);

    expect(
      (await db.query('select banner_items from pixelar_profiles where member_id=$1', [owner])).rows
    ).toEqual([{ banner_items: { game: null, screen: other } }]);
  });

  it('rejects banners belonging to another owner or library and handles deleted titles', async () => {
    await insert({}, 'playing');

    await expect(
      db.query("select pixelar_save_banner($1,'game',$2)", [other, item])
    ).rejects.toThrow(/not found/);
    await expect(
      db.query("select pixelar_save_banner($1,'screen',$2)", [owner, item])
    ).rejects.toThrow(/not found/);
    await expect(
      db.query("select pixelar_save_banner($1,'other',$2)", [owner, item])
    ).rejects.toThrow(/Invalid library/);
    await expect(db.query('select pixelar_save_banner($1,null,null)', [owner])).rejects.toThrow(
      /Invalid library/
    );

    await db.query("select pixelar_save_banner($1,'game',$2)", [owner, item]);
    await db.query("update pixelar_items set status='completed' where id=$1", [item]);

    await expect(
      db.query("select pixelar_save_banner($1,'game',$2)", [owner, item])
    ).rejects.toThrow(/not found/);

    await db.query('delete from pixelar_items where id=$1', [item]);

    await expect(
      db.query("select pixelar_save_banner($1,'game',$2)", [owner, item])
    ).rejects.toThrow(/not found/);

    await db.query("select pixelar_save_banner($1,'game',null)", [owner]);

    expect(
      (await db.query('select banner_items from pixelar_profiles where member_id=$1', [owner])).rows
    ).toEqual([{ banner_items: { game: null } }]);
  });

  it('denies Pixelar browser storage access without changing other bucket access', async () => {
    await db.exec(
      "insert into storage.objects values('avatar','pixelar_avatars'),('caelum','caelum_test_bucket');grant usage on schema storage to anon;set role anon"
    );

    expect((await db.query('select id from storage.objects')).rows).toEqual([{ id: 'caelum' }]);
    await expect(
      db.query("insert into storage.objects values('bad','pixelar_avatars')")
    ).rejects.toThrow(/row-level security/);

    await db.exec('reset role');
  });

  it('rejects cross-account reminder ownership and incompatible statuses', async () => {
    await insert();

    await expect(
      db.query('insert into pixelar_reminders(item_id,member_id,days_before) values($1,$2,7)', [
        item,
        other,
      ])
    ).rejects.toThrow(/foreign key/);
    await expect(
      db.query("update pixelar_items set status='watched' where id=$1", [item])
    ).rejects.toThrow(/foreign key/);
  });

  it('saves item/reminders atomically and rejects another owner updating an item', async () => {
    await insert();

    const payload = {
      id: item,
      kind: 'game',
      status: 'playing',
      metadata_id: null,
      overrides: { title: 'Edited' },
      platforms: [],
      services: [],
      price: null,
      currency: 'GBP',
      notes: '',
      auto_move: true,
      reminder_days: [7],
    };

    await expect(
      db.query('select pixelar_save_item($1,$2)', [other, JSON.stringify(payload)])
    ).rejects.toThrow(/Item not found/);

    await db.query('select pixelar_save_item($1,$2)', [owner, JSON.stringify(payload)]);

    expect(await status()).toBe('playing');
    expect((await db.query('select days_before from pixelar_reminders')).rows).toEqual([
      { days_before: 7 },
    ]);
    await expect(
      db.query('select pixelar_save_item($1,$2)', [
        owner,
        JSON.stringify({ ...payload, status: 'completed', reminder_days: [999] }),
      ])
    ).rejects.toThrow();
    expect(await status()).toBe('playing');
  });
});

describe('release job', () => {
  it('moves after London midnight and delivers at 9am, once across repeated/concurrent calls', async () => {
    await insert();
    await process('2026-10-17T22:59:00Z');

    expect(await status()).toBe('scheduled');

    await process('2026-10-17T23:00:00Z');

    expect(await status()).toBe('backlog');
    expect(await count()).toBe(0);

    await process('2026-10-18T07:59:00Z');

    expect(await count()).toBe(0);

    await Promise.all([process('2026-10-18T08:00:00Z'), process('2026-10-18T08:00:00Z')]);
    await process('2026-10-18T09:00:00Z');

    expect(await count()).toBe(1);
  });

  it('handles spring DST, midnight and 9am using local time', async () => {
    await insert({ release_date: '2026-03-30' });
    await process('2026-03-29T22:59:00Z');

    expect(await status()).toBe('scheduled');

    await process('2026-03-29T23:00:00Z');

    expect(await status()).toBe('backlog');

    await process('2026-03-30T08:00:00Z');

    expect(await count()).toBe(1);
  });

  it('handles autumn DST when 9am returns to UTC', async () => {
    await insert({ release_date: '2026-10-25' });
    await process('2026-10-25T08:59:00Z');

    expect(await count()).toBe(0);

    await process('2026-10-25T09:00:00Z');

    expect(await count()).toBe(1);
  });

  it.each([
    'playing',
    'replay',
    'completed',
    'dropped',
  ])('preserves manually chosen %s', async (value) => {
    await insert({}, value);
    await process('2026-10-18T12:00:00Z');

    expect(await status()).toBe(value);
  });

  it('honours auto-move opt-out and notification preferences independently', async () => {
    await insert({}, 'scheduled', false);
    await process('2026-10-18T12:00:00Z');

    expect(await status()).toBe('scheduled');
    expect(await count()).toBe(1);

    await db.exec('delete from pixelar_notifications');
    await db.query(
      'insert into pixelar_profiles(member_id,notifications_enabled) values($1,false)',
      [owner]
    );
    await process('2026-10-18T12:00:00Z');

    expect(await count()).toBe(0);
  });

  it.each([
    'year',
    'month',
    'unknown',
  ])('suspends reminders and moves for %s precision', async (precision) => {
    await insert({ release_precision: precision });
    await process('2026-10-18T12:00:00Z');

    expect(await status()).toBe('scheduled');
    expect(await count()).toBe(0);
  });

  it('suspends missing and explicitly cleared dates', async () => {
    await insert({ release_date: null });
    await process('2026-10-18T12:00:00Z');

    expect(await count()).toBe(0);
    expect(await status()).toBe('scheduled');
  });

  it('catches up a missed release once and does not send stale advance reminders', async () => {
    await insert();
    await db.query('insert into pixelar_reminders(item_id,member_id,days_before) values($1,$2,7)', [
      item,
      owner,
    ]);
    await process('2026-10-22T12:00:00Z');
    await process('2026-10-23T12:00:00Z');

    expect(await status()).toBe('backlog');
    expect(await count()).toBe(1);
  });

  it('uses changed dates for pending reminders and catches up advance reminders before release', async () => {
    await insert({ release_date: '2026-11-19' });
    await db.query('insert into pixelar_reminders(item_id,member_id,days_before) values($1,$2,7)', [
      item,
      owner,
    ]);
    await process('2026-10-18T12:00:00Z');

    expect(await count()).toBe(0);

    await process('2026-11-14T12:00:00Z');

    expect(await count()).toBe(1);

    await db.query(
      "update pixelar_items set overrides=jsonb_set(overrides,'{release_date}','\"2026-12-01\"') where id=$1",
      [item]
    );
    await process('2026-11-19T12:00:00Z');

    expect(await status()).toBe('scheduled');
    expect(await count()).toBe(1);

    await process('2026-12-01T12:00:00Z');

    expect(await status()).toBe('backlog');
    expect(await count()).toBe(2);
  });

  it('moves Upcoming movies/shows into Watchlist and scopes page reconciliation', async () => {
    await insert({}, 'upcoming', true, 'show');
    await process('2026-10-18T12:00:00Z', other);

    expect(await status()).toBe('upcoming');

    await process('2026-10-18T12:00:00Z', null);

    expect(await status()).toBe('watchlist');
  });
});
