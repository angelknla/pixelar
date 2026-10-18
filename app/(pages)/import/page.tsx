import Import from '@components/Import/Import';
import Theme from '@components/Profile/Theme';
import { listItems, profileFor, requireAccount } from '@/lib/data/library';
export default async function ImportPage() {
  const account = await requireAccount();
  const [items, profile] = await Promise.all([
    listItems(account.memberId),
    profileFor(account.memberId),
  ]);
  return (
    <>
      <Theme theme={profile.theme} />
      <Import items={items} profile={profile} />
    </>
  );
}
