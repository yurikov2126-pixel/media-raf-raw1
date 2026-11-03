"""Deterministic isolated local handover controller.

Runs only with injected local subprocess adapters; not attached to the
running central_playout loop, Android notifications, station mixer, or PA.
The caller must first establish physical output isolation.
"""
from dataclasses import dataclass

@dataclass(frozen=True)
class HandoverResult:
    ok: bool
    reason: str
    phases: tuple
    program_restored: bool
    alarm_natural_completion: bool

def run_isolated_handover(*, is_isolated, pause_program, play_training,
                          resume_program, confirm_restored, repeats=1):
    """Pause local program -> play all repeats -> resume local program.

    Each adapter must complete synchronously and return evidence. Never
    start the training audio if pausing the local program is unconfirmed.
    Always attempt program restoration after a confirmed pause.
    """
    phases=[]
    if is_isolated is not True:
        return HandoverResult(False,'PHYSICAL_ISOLATION_REQUIRED',tuple(phases),False,False)
    if type(repeats) is not int or repeats<1 or repeats>5:
        return HandoverResult(False,'INVALID_REPEATS',tuple(phases),False,False)
    if not all(callable(fn) for fn in
               (pause_program,play_training,resume_program,confirm_restored)):
        return HandoverResult(False,'ADAPTER_REQUIRED',tuple(phases),False,False)

    paused=False
    natural=False
    failed=None
    restored=False
    try:
        phases.append('PAUSE_PROGRAM')
        pause_result=pause_program()
        if pause_result is not True:
            return HandoverResult(False,'PROGRAM_PAUSE_UNCONFIRMED',
                                  tuple(phases),False,False)
        paused=True
        phases.append('PLAY_TRAINING')
        receipt=play_training(repeats)
        natural=(isinstance(receipt,dict) and
                 receipt.get('state')=='COMPLETED' and
                 receipt.get('naturalCompletion') is True and
                 receipt.get('completedRepeats')==repeats and
                 receipt.get('expectedRepeats')==repeats and
                 receipt.get('processRunning') is False and
                 receipt.get('failureReason') is None)
        if not natural:
            failed='TRAINING_NOT_NATURALLY_COMPLETED'
    except Exception:
        failed='ADAPTER_EXCEPTION'
    finally:
        if paused:
            phases.append('RESUME_PROGRAM')
            try:
                resumed=resume_program()
                if resumed is True:
                    phases.append('CONFIRM_PROGRAM')
                    restored=confirm_restored() is True
            except Exception:
                restored=False
    if not restored:
        return HandoverResult(False,'PROGRAM_RETURN_UNCONFIRMED',
                              tuple(phases),False,natural)
    if failed:
        return HandoverResult(False,failed,tuple(phases),True,natural)
    return HandoverResult(True,'ISOLATED_HANDOVER_CONFIRMED',
                          tuple(phases),True,True)
