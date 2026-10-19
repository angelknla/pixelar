'use client';
import { Bell, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { markAllNotificationsRead, markNotificationRead } from '@/app/library-actions';
import { isUpcoming, label, localDay, releaseLabel } from '@/lib/library';
import type { LibraryItem, NotificationRow, ProfileRow } from '@/types/library';
import Countdown from '../Library/Countdown';
export default function Calendar({
  items,
  notifications,
  profile,
}: {
  items: LibraryItem[];
  notifications: NotificationRow[];
  profile: ProfileRow;
}) {
  const today = localDay(profile.timezone);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const [readIds, setReadIds] = useState<string[]>([]);
  const unread = notifications.filter((n) => !n.read_at && !readIds.includes(n.id));
  const router = useRouter();
  const calendar = useRef<HTMLElement>(null);
  const layout = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const panel = calendar.current;
    const container = layout.current;
    if (!panel || !container || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      container.style.setProperty('--calendar-height', `${panel.getBoundingClientRect().height}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    return () => observer.disconnect();
  }, []);
  const upcoming = items
    .filter((i) => isUpcoming(i, profile.timezone))
    .sort((a, b) => (a.fields.release_date ?? '').localeCompare(b.fields.release_date ?? ''));
  const first = new Date(`${month}-01T12:00:00Z`);
  const days = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const padding = (first.getUTCDay() + 6) % 7;
  const dayItems = (day: string) =>
    items.filter((i) => i.fields.release_precision === 'day' && i.fields.release_date === day);
  const visible = selected
    ? items.filter(
        (i) => i.fields.release_precision === 'day' && i.fields.release_date === selected
      )
    : upcoming;
  function shift(delta: number) {
    const next = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + delta, 1));
    setMonth(next.toISOString().slice(0, 7));
    setSelected(null);
  }
  function markRead(id?: string) {
    setError('');
    start(async () => {
      try {
        const result = id ? await markNotificationRead(id) : await markAllNotificationsRead();
        if (result.error) setError(result.error);
        else {
          setReadIds((previous) => [...previous, ...(id ? [id] : unread.map((n) => n.id))]);
          router.refresh();
        }
      } catch {
        setError('Could not mark notifications read. Please try again.');
      }
    });
  }
  return (
    <>
      <header className="pageHeading">
        <div>
          <span className="eyebrow">Coming soon</span>
          <h1>Release calendar</h1>
          <p>Every game, movie, and show you’re looking forward to, in one place.</p>
        </div>
        <span className="timezoneBadge">{profile.timezone}</span>
      </header>
      <div className="calendarLayout" ref={layout}>
        <section className="calendarPanel" ref={calendar}>
          <div className="monthHeading">
            <button type="button" aria-label="Previous month" onClick={() => shift(-1)}>
              <ChevronLeft size={18} />
            </button>
            <h2>
              {new Intl.DateTimeFormat('en-GB', {
                month: 'long',
                year: 'numeric',
                timeZone: 'UTC',
              }).format(first)}
            </h2>
            <button type="button" aria-label="Next month" onClick={() => shift(1)}>
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="calendarGrid">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <span key={d} className="weekDay">
                {d}
              </span>
            ))}
            {Array.from({ length: padding }, (_, i) => (
              <span key={`blank-${i}`} />
            ))}
            {Array.from({ length: days }, (_, i) => {
              const day = `${month}-${String(i + 1).padStart(2, '0')}`;
              const titles = dayItems(day);
              return (
                <button
                  type="button"
                  key={day}
                  className={`calendarDay ${day === today ? 'today' : ''} ${selected === day ? 'selected' : ''}`}
                  aria-label={`${day}: ${titles.length} releases${titles.length ? `, ${titles.map((t) => t.fields.title).join(', ')}` : ''}`}
                  aria-pressed={selected === day}
                  onClick={() => setSelected(selected === day ? null : day)}
                >
                  <span>{i + 1}</span>
                  <div className="dateDots">
                    {titles.slice(0, 3).map((t) => (
                      <span className={`dateDot ${t.kind}`} key={t.id} />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="calendarLegend">
            <span>
              <i className="dateDot game" /> Games
            </span>
            <span>
              <i className="dateDot movie" /> Movies / TV
            </span>
            <button
              type="button"
              className="textButton"
              onClick={() => {
                setMonth(today.slice(0, 7));
                setSelected(null);
              }}
            >
              Today
            </button>
          </div>
        </section>
        <section className="upcomingPanel">
          <div className="sectionHeading">
            <h2>
              {selected
                ? `Releases on ${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${selected}T12:00:00Z`))}`
                : 'Coming up'}
            </h2>
            {selected && (
              <button type="button" className="textButton" onClick={() => setSelected(null)}>
                Show all
              </button>
            )}
          </div>
          {/* biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users need to scroll the release list. */}
          <section className="upcomingList" aria-label="Upcoming releases" tabIndex={0}>
            {visible.length ? (
              visible.map((item) => (
                <Link key={item.id} href={`/items/${item.id}`} className="upcomingRow">
                  <span className={`typeBadge ${item.kind}`}>
                    {item.kind === 'game' ? 'PLAY' : 'WATCH'}
                  </span>
                  <div>
                    <strong>{item.fields.title}</strong>
                    <small>
                      {releaseLabel(item.fields)} · {label(item.status)}
                      {item.fields.release_precision !== 'day' ? ' · Release window' : ''}
                    </small>
                  </div>
                  <Countdown fields={item.fields} timezone={profile.timezone} />
                </Link>
              ))
            ) : (
              <div className="emptyState">
                <h3>Nothing on the calendar yet.</h3>
                <p>Add a release date to a title and it will appear here.</p>
              </div>
            )}
          </section>
        </section>
      </div>
      <section className="notificationPanel">
        <div className="sectionHeading">
          <h2>
            <Bell size={20} /> Your notifications{' '}
            <span className="countBadge">{unread.length} unread</span>
          </h2>
          <div className="notificationActions">
            <span className="hint">In-app · 9am local time</span>
            {unread.length > 0 && (
              <button
                type="button"
                className="textButton"
                disabled={pending}
                onClick={() => markRead()}
              >
                Mark all as read
              </button>
            )}
          </div>
        </div>
        {error && (
          <p role="alert" className="errorMessage">
            {error}
          </p>
        )}
        {notifications.length ? (
          notifications.map((n) => (
            <article
              className={`notificationRow ${n.read_at || readIds.includes(n.id) ? 'read' : ''}`}
              key={n.id}
            >
              <div>
                <Link href={`/items/${n.item_id}`}>{n.title}</Link>
                <small>
                  {new Intl.DateTimeFormat('en-GB', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                    timeZone: profile.timezone,
                  }).format(new Date(n.created_at))}
                </small>
              </div>
              {!n.read_at && !readIds.includes(n.id) && (
                <button type="button" disabled={pending} onClick={() => markRead(n.id)}>
                  Mark read
                </button>
              )}
            </article>
          ))
        ) : (
          <p className="emptyShelf">You’re all caught up. Release reminders will show up here.</p>
        )}
      </section>
    </>
  );
}
