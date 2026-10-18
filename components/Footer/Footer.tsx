import InstallApp from '@components/InstallApp/InstallApp';
import Image from 'next/image';
import Link from 'next/link';

export default function Footer({ signedIn }: { signedIn: boolean }) {
  return (
    <footer className="appFooter">
      <div className="footerInner">
        <div className="footerIdentity">
          <Link className="footerBrand" href={signedIn ? '/games' : '/'}>
            <Image src="/icon.svg?v=2" alt="" width={24} height={24} unoptimized />
            pixelar<span>.</span>
          </Link>
          <p>Games. Movies. TV. One library.</p>
        </div>
        <div className="footerInstall">
          <InstallApp sidebarTargetId={signedIn ? 'sidebar-install' : undefined} />
        </div>
      </div>
    </footer>
  );
}
