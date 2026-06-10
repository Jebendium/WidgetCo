import { SubmitBox } from '@/components/SubmitBox';

export const dynamic = 'force-dynamic';

export default function AgmPage() {
  return (
    <>
      <div className="panel">
        <h2>Annual General Meeting</h2>
        <p className="smallprint">
          Shareholders may submit questions below. By tradition, the Board answers the questions
          it has prepared for and notes the others for response in due course. The AGM concludes
          with refreshments, the quality of which is itself a recurring item of governance.
        </p>
      </div>
      <SubmitBox
        kind="agm"
        prompt="Submit a question to the Board"
        button="Submit question"
      />
    </>
  );
}
