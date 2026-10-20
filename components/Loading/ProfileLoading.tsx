import LoadingHeading from './LoadingHeading';
import LoadingState from './LoadingState';
import SkeletonBar from './SkeletonBar';
import SkeletonChips from './SkeletonChips';
import SkeletonField from './SkeletonField';

const ProfileLoading = () => {
  return (
    <LoadingState label="Loading your profile">
      <LoadingHeading
        eyebrow="Account & preferences"
        title="Your profile"
        description="Your details, platforms, and streaming services."
      />
      <div className="profileLayout">
        <section className="profileIdentity skeletonIdentity">
          <SkeletonBar className="skeletonAvatar" />
          <SkeletonBar className="skeletonMedium" />
          <SkeletonBar className="skeletonShort" />
          <SkeletonBar className="skeletonButton" />
        </section>
        <div className="profileForm">
          <fieldset>
            <legend>Account</legend>
            <SkeletonField label="Display name" />
            <SkeletonField label="Email" />
          </fieldset>
          <fieldset>
            <legend>Where you are</legend>
            <div className="formGrid">
              <SkeletonField label="Region (country code)" />
              <SkeletonField label="Currency" />
            </div>
            <SkeletonField label="Timezone" />
            <SkeletonBar />
          </fieldset>
          <fieldset>
            <legend>Platforms you own</legend>
            <SkeletonChips count={9} />
          </fieldset>
          <fieldset>
            <legend>Your streaming subscriptions</legend>
            <SkeletonChips count={7} />
          </fieldset>
          <fieldset>
            <legend>Preferences</legend>
            <SkeletonField label="Appearance" />
            <SkeletonBar className="skeletonMedium" />
            <SkeletonBar className="skeletonMedium" />
          </fieldset>
          <SkeletonBar className="skeletonButton" />
        </div>
      </div>
    </LoadingState>
  );
};

export default ProfileLoading;
