import { planRadioResumeAfterExternalAudio } from './mchsRadioResumePlan.js';
import { validateSourceTransition } from './radioSourceTransitionGuard.js';

/** Read-only compatibility check between existing radio authority gate and MCHS recovery decisions.
 * No state mutation, no worker API, no output permission.
 */
export function inspectMchsRadioAuthority({ previous, current, scheduleKnown=false,
  scheduleActive, publicLive=false, handoverTarget=null }={}) {
  const resume=planRadioResumeAfterExternalAudio({
    previous,current,scheduleKnown,scheduleActive,liveActive:publicLive,
  });
  let handover=null;
  if (handoverTarget) {
    handover=validateSourceTransition({
      source: current?.id ? current : null,
      target:handoverTarget,
      slotKnown:scheduleKnown,scheduledActive:scheduleActive,
      publicLive,overlapMs:1500,
    });
  }
  const conflictingHandover = Boolean(handover?.allowed && (
    resume.action==='NO_ACTION' || resume.action==='RESOLVE_MANUAL_PLAYLIST_AT_CURRENT_POSITION'
  ));
  return {
    resume, handover:handover && { allowed:handover.allowed,reason:handover.reason||null },
    consistent:!conflictingHandover, observableOnly:true, canDispatch:false,
  };
}
