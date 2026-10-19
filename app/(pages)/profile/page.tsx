import Profile from '@components/Profile/Profile';
import { profileFor, requireAccount } from '@/lib/data/library';

const ProfilePage = async () => {
  const account = await requireAccount();
  const profile = await profileFor(account.memberId);

  return <Profile account={account} profile={profile} />;
};

export default ProfilePage;
