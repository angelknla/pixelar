import LoadingState from './LoadingState';
import SkeletonBar from './SkeletonBar';
import LoadingHeading from './LoadingHeading';

const CalendarLoading = () => {
  return (
    <LoadingState label="Loading your release calendar" className="loadingCalendar">
      <LoadingHeading
        eyebrow="Coming soon"
        title="Release calendar"
        description="Every game, movie, and show you’re looking forward to, in one place."
      />
      <div className="calendarLayout">
        <section className="calendarPanel">
          <div className="monthHeading">
            <SkeletonBar className="skeletonView" />
            <SkeletonBar className="skeletonMonth" />
            <SkeletonBar className="skeletonView" />
          </div>
          <div className="calendarGrid">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <span className="weekDay" key={day}>
                {day}
              </span>
            ))}
            {Array.from({ length: 35 }, (_, i) => (
              <div className="calendarDay" key={i}>
                <SkeletonBar className="skeletonDay" />
              </div>
            ))}
          </div>
          <div className="calendarLegend">
            <SkeletonBar className="skeletonStat" />
            <SkeletonBar className="skeletonStat" />
            <SkeletonBar className="skeletonCount" />
          </div>
        </section>
        <section className="upcomingPanel">
          <div className="sectionHeading">
            <h2>Coming up</h2>
          </div>
          <div className="upcomingList">
            {Array.from({ length: 6 }, (_, i) => (
              <div className="upcomingRow" key={i}>
                <SkeletonBar className="skeletonType" />
                <div>
                  <SkeletonBar className="skeletonMedium" />
                  <SkeletonBar className="skeletonShort" />
                </div>
                <SkeletonBar className="skeletonCounter" />
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="notificationPanel">
        <div className="sectionHeading">
          <h2>Your notifications</h2>
          <SkeletonBar className="skeletonStat" />
        </div>
        {Array.from({ length: 3 }, (_, i) => (
          <div className="notificationRow" key={i}>
            <div>
              <SkeletonBar className="skeletonMedium" />
              <SkeletonBar className="skeletonShort" />
            </div>
            <SkeletonBar className="skeletonButton" />
          </div>
        ))}
      </section>
    </LoadingState>
  );
};

export default CalendarLoading;
