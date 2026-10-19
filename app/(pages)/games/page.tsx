import Library from '@components/Library/Library';
import Theme from '@components/Profile/Theme';
import { listItems, profileFor, reconcile, requireAccount } from '@/lib/data/library';

const GamesPage = async () => {
  const account = await requireAccount();

  await reconcile(account.memberId);

  const [items, profile] = await Promise.all([
    listItems(account.memberId),
    profileFor(account.memberId),
  ]);

  return (
    <>
      <Theme theme={profile.theme} />
      <Library items={items} profile={profile} kind="game" />
    </>
  );
};

export default GamesPage;
