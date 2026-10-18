'use client';
import { CalendarDays, Gamepad2, MonitorPlay, UserRound } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/games', title: 'Games', Icon: Gamepad2 },
  { href: '/screen', title: 'TV', Icon: MonitorPlay },
  { href: '/calendar', title: 'Calendar', Icon: CalendarDays },
  { href: '/profile', title: 'Profile', Icon: UserRound },
];
export default function Navigation() {
  const path = usePathname();
  return (
    <nav className="appNav" aria-label="Library navigation">
      <Link className="navBrand" href="/games">
        <Image src="/icon.svg?v=2" width={38} height={38} alt="" className="brandMark" unoptimized />
        pixelar<span className="brandDot">.</span>
      </Link>
      <div className="navTabs">
        {tabs.map(({ href, title, Icon }) => (
          <Link
            key={href}
            href={href}
            className={path.startsWith(href) ? 'active' : ''}
            aria-current={path.startsWith(href) ? 'page' : undefined}
          >
            <Icon size={22} />
            <span>{title}</span>
          </Link>
        ))}
      </div>
      <div className="navFooter">
        <div id="sidebar-install" className="navInstall" />
        <p className="navNote">
          A little less scrolling.
          <br />A little more playing.
        </p>
      </div>
    </nav>
  );
}
