import type { ReactNode } from 'react';
import authStyles from '../AuthForm/AuthForm.module.css';

function LoadingState({
  children,
  label,
  className = '',
}: {
  children: ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <div className={`loadingPage ${className}`} role="status" aria-busy="true">
      <span className="srOnly">{label}</span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}

function Bar({ className = '' }: { className?: string }) {
  return <div className={`skeleton skeletonBar ${className}`} />;
}

function Heading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="pageHeading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </header>
  );
}

function Field({ label, tall = false }: { label: string; tall?: boolean }) {
  return (
    <div className="skeletonField">
      <span>{label}</span>
      <Bar className={tall ? 'skeletonTextarea' : 'skeletonInput'} />
    </div>
  );
}

function Chips({ count = 6 }: { count?: number }) {
  return (
    <div className="skeletonChips">
      {Array.from({ length: count }, (_, i) => (
        <Bar className="skeletonChip" key={i} />
      ))}
    </div>
  );
}

function Tile({ game }: { game: boolean }) {
  return (
    <div className={`itemCard skeletonTile ${game ? 'gameTile' : 'screenTile'}`}>
      <div className="cardArtLink">
        <div className={`artwork skeleton ${game ? 'gameArt' : 'screenArt'}`} />
      </div>
      <div className="cardBody">
        <div className="cardTop">
          <div className="skeletonTileTitle">
            <Bar />
            <Bar className="skeletonShort" />
          </div>
          <Bar className="skeletonGrip" />
        </div>
        <div className="cardMeta">
          <Bar className="skeletonMedium" />
        </div>
        <div className="cardRelease">
          <Bar className="skeletonDate" />
          <Bar className="skeletonCounter" />
        </div>
        <div className="cardFoot">
          <Bar className="skeletonInput" />
        </div>
      </div>
    </div>
  );
}

export function LibraryLoading({ kind }: { kind: 'game' | 'screen' }) {
  const game = kind === 'game';
  return (
    <LoadingState label={`Loading your ${game ? 'games' : 'movies and TV series'}`}>
      <div className={`libraryPage ${game ? 'gameLibrary' : 'screenLibrary'}`}>
        <section className="libraryHero">
          <header className="pageHeading">
            <div>
              <span className="eyebrow">Your collection</span>
              <h1>{game ? 'Game library' : 'Movies & TV'}</h1>
              <p>
                {game
                  ? 'Pick up where you left off. Find your next adventure.'
                  : 'Your next movie night. Your next must-watch series.'}
              </p>
            </div>
            <Bar className="skeletonButton" />
          </header>
          <div className="heroFeature">
            <div className="artwork skeleton" />
            <div className="heroFeatureCaption">
              <Bar className="skeletonChip" />
              <Bar className="skeletonHeroTitle" />
              <Bar className="skeletonShort" />
            </div>
          </div>
        </section>
        <div className="libraryStats">
          <Bar className="skeletonStat" />
          <Bar className="skeletonStat" />
          <Bar className="skeletonStat skeletonStatLink" />
        </div>
        <div className="libraryControls">
          <div className="toolbar">
            <Bar className="skeletonSearch" />
            <div className="skeletonViews">
              {Array.from({ length: game ? 2 : 3 }, (_, i) => (
                <Bar className="skeletonView" key={i} />
              ))}
            </div>
          </div>
          <div className="libraryFilterRow">
            {!game && (
              <div className="screenTypePicker libraryTypePicker skeletonTypes">
                <span>All titles</span>
                <span>Movies</span>
                <span>TV series</span>
              </div>
            )}
            <div className="filters">
              <Bar className="skeletonFilter" />
              <Bar className="skeletonFilter" />
              <Bar className="skeletonFilter" />
              <span className="filterCount">
                <Bar className="skeletonCount" />
              </span>
            </div>
          </div>
        </div>
        {Array.from({ length: 2 }, (_, shelf) => (
          <section className="shelf" key={shelf}>
            <div className="shelfHeading">
              <div className="skeletonShelfHeading">
                <span className="shelfDot" />
                <Bar className="skeletonShelfTitle" />
                <Bar className="skeletonCount" />
              </div>
            </div>
            {game ? (
              <div className="cardGrid">
                {Array.from({ length: 6 }, (_, i) => (
                  <Tile game key={i} />
                ))}
              </div>
            ) : (
              <div className="skeletonPosterRows">
                {Array.from({ length: 2 }, (_, row) => (
                  <div className="cardGrid skeletonPosterRow" key={row}>
                    {Array.from({ length: 16 }, (_, i) => (
                      <Tile game={false} key={i} />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </LoadingState>
  );
}

export function CalendarLoading() {
  return (
    <LoadingState label="Loading your release calendar" className="loadingCalendar">
      <Heading
        eyebrow="Coming soon"
        title="Release calendar"
        description="Every game, movie, and show you’re looking forward to, in one place."
      />
      <div className="calendarLayout">
        <section className="calendarPanel">
          <div className="monthHeading">
            <Bar className="skeletonView" />
            <Bar className="skeletonMonth" />
            <Bar className="skeletonView" />
          </div>
          <div className="calendarGrid">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <span className="weekDay" key={day}>
                {day}
              </span>
            ))}
            {Array.from({ length: 35 }, (_, i) => (
              <div className="calendarDay" key={i}>
                <Bar className="skeletonDay" />
              </div>
            ))}
          </div>
          <div className="calendarLegend">
            <Bar className="skeletonStat" />
            <Bar className="skeletonStat" />
            <Bar className="skeletonCount" />
          </div>
        </section>
        <section className="upcomingPanel">
          <div className="sectionHeading">
            <h2>Coming up</h2>
          </div>
          <div className="upcomingList">
            {Array.from({ length: 6 }, (_, i) => (
              <div className="upcomingRow" key={i}>
                <Bar className="skeletonType" />
                <div>
                  <Bar className="skeletonMedium" />
                  <Bar className="skeletonShort" />
                </div>
                <Bar className="skeletonCounter" />
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="notificationPanel">
        <div className="sectionHeading">
          <h2>Your notifications</h2>
          <Bar className="skeletonStat" />
        </div>
        {Array.from({ length: 3 }, (_, i) => (
          <div className="notificationRow" key={i}>
            <div>
              <Bar className="skeletonMedium" />
              <Bar className="skeletonShort" />
            </div>
            <Bar className="skeletonButton" />
          </div>
        ))}
      </section>
    </LoadingState>
  );
}

export function ProfileLoading() {
  return (
    <LoadingState label="Loading your profile">
      <Heading
        eyebrow="Account & preferences"
        title="Your profile"
        description="Your details, platforms, and streaming services."
      />
      <div className="profileLayout">
        <section className="profileIdentity skeletonIdentity">
          <Bar className="skeletonAvatar" />
          <Bar className="skeletonMedium" />
          <Bar className="skeletonShort" />
          <Bar className="skeletonButton" />
        </section>
        <div className="profileForm">
          <fieldset>
            <legend>Account</legend>
            <Field label="Display name" />
            <Field label="Email" />
          </fieldset>
          <fieldset>
            <legend>Where you are</legend>
            <div className="formGrid">
              <Field label="Region (country code)" />
              <Field label="Currency" />
            </div>
            <Field label="Timezone" />
            <Bar />
          </fieldset>
          <fieldset>
            <legend>Platforms you own</legend>
            <Chips count={9} />
          </fieldset>
          <fieldset>
            <legend>Your streaming subscriptions</legend>
            <Chips count={7} />
          </fieldset>
          <fieldset>
            <legend>Preferences</legend>
            <Field label="Appearance" />
            <Bar className="skeletonMedium" />
            <Bar className="skeletonMedium" />
          </fieldset>
          <Bar className="skeletonButton" />
        </div>
      </div>
    </LoadingState>
  );
}

export function ImportLoading() {
  return (
    <LoadingState label="Loading notes import">
      <Heading
        eyebrow="From your notes to your next night in"
        title="Bring your list along."
        description="Paste your notes, check the titles, and give them a new home."
      />
      <section className="importPaste">
        <Field label="Your notes" tall />
        <div className="skeletonHint">
          <Bar />
          <Bar className="skeletonMedium" />
        </div>
        <Bar className="skeletonButton" />
      </section>
    </LoadingState>
  );
}

export function ItemLoading() {
  return (
    <LoadingState label="Loading title details">
      <Bar className="skeletonBack" />
      <div className="editor skeletonEditor">
        <div className="editorHeading">
          <div>
            <Bar className="skeletonShort" />
            <Bar className="skeletonEditorTitle" />
          </div>
        </div>
        <div className="searchBox">
          <Field label="Find a title" />
          <Bar className="skeletonHint" />
        </div>
        <div className="skeletonForm">
          <Field label="Title" />
          <div className="formGrid">
            <Field label="Status" />
            <Field label="Metacritic score" />
            <Field label="Release precision" />
            <Field label="Release date" />
          </div>
          <Chips />
          <div className="formGrid">
            <Field label="Price (optional)" />
            <Field label="Currency" />
          </div>
          <Field label="Cover / poster URL" />
          <Field label="Publisher / studio" />
          <Field label="Description" tall />
          <Field label="My notes" tall />
          <Bar className="skeletonButton" />
        </div>
      </div>
    </LoadingState>
  );
}

export function RegisterLoading() {
  return (
    <LoadingState label="Loading account registration">
      <section className={authStyles.section}>
        <h1>Create account</h1>
        <div className={authStyles.form}>
          <fieldset>
            <Field label="App passcode" />
            <Field label="Name" />
            <Field label="Username" />
            <Field label="Email" />
            <Field label="Password" />
            <Bar className="skeletonInput" />
          </fieldset>
        </div>
        <Bar className="skeletonShort" />
      </section>
    </LoadingState>
  );
}

export function PageLoading() {
  return (
    <LoadingState label="Loading Pixelar">
      <Bar className="skeletonEditorTitle" />
      <div className="skeletonHint">
        <Bar className="skeletonMedium" />
        <Bar className="skeletonShort" />
      </div>
    </LoadingState>
  );
}
