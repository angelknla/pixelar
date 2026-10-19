import ItemEditor from '@components/Library/ItemEditor';
import Theme from '@components/Profile/Theme';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db, profileFor, remindersFor, requireAccount } from '@/lib/data/library';
import { effectiveFields } from '@/lib/library';
import { uuid } from '@/lib/validation';

const ItemPage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const account = await requireAccount();
  const { id } = await params;

  try {
    uuid(id);
  } catch {
    notFound();
  }

  const { data: item, error } = await db()
    .from('pixelar_items')
    .select('*')
    .eq('id', id)
    .eq('member_id', account.memberId)
    .maybeSingle();

  if (error || !item) notFound();

  const metadata = item.metadata_id
    ? (await db().from('pixelar_metadata_cache').select('*').eq('id', item.metadata_id).single())
        .data
    : null;
  const [profile, reminders] = await Promise.all([
    profileFor(account.memberId),
    remindersFor(account.memberId, id),
  ]);

  return (
    <>
      <Theme theme={profile.theme} />
      <Link className="backLink" href={item.kind === 'game' ? '/games' : '/screen'}>
        ← Back to library
      </Link>
      <ItemEditor
        kind={item.kind}
        profile={profile}
        item={{
          ...item,
          metadata,
          fields: effectiveFields(metadata?.fields ?? null, item.overrides),
        }}
        reminderDays={reminders.filter((r) => r.enabled).map((r) => r.days_before)}
      />
    </>
  );
};

export default ItemPage;
