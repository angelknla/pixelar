import authStyles from '../AuthForm/AuthForm.module.css';
import LoadingState from './LoadingState';
import SkeletonBar from './SkeletonBar';
import SkeletonField from './SkeletonField';

const RegisterLoading = () => {
  return (
    <LoadingState label="Loading account registration">
      <section className={authStyles.section}>
        <h1>Create account</h1>
        <div className={authStyles.form}>
          <fieldset>
            <SkeletonField label="App passcode" />
            <SkeletonField label="Name" />
            <SkeletonField label="Username" />
            <SkeletonField label="Email" />
            <SkeletonField label="Password" />
            <SkeletonBar className="skeletonInput" />
          </fieldset>
        </div>
        <SkeletonBar className="skeletonShort" />
      </section>
    </LoadingState>
  );
};

export default RegisterLoading;
