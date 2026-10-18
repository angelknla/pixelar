import Library from '@components/Library/Library';
import Theme from '@components/Profile/Theme';
import { listItems, profileFor, reconcile, requireAccount } from '@/lib/data/library';
export default async function ScreenPage() {
  const account = await requireAccount();
  await reconcile(account.memberId);
  const [items, profile] = await Promise.all([
    listItems(account.memberId),
    profileFor(account.memberId),
  ]);
  return (
    <>
      <Theme theme={profile.theme} />
      <Library items={items} profile={profile} kind="screen" />
    </>
  );
}
