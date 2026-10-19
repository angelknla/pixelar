import Calendar from '@components/Calendar/Calendar';
import Theme from '@components/Profile/Theme';
import {
  listItems,
  notificationsFor,
  profileFor,
  reconcile,
  requireAccount,
} from '@/lib/data/library';

const CalendarPage = async () => {
  const account = await requireAccount();

  await reconcile(account.memberId);

  const [items, notifications, profile] = await Promise.all([
    listItems(account.memberId),
    notificationsFor(account.memberId),
    profileFor(account.memberId),
  ]);

  return (
    <>
      <Theme theme={profile.theme} />
      <Calendar items={items} notifications={notifications} profile={profile} />
    </>
  );
};

export default CalendarPage;
