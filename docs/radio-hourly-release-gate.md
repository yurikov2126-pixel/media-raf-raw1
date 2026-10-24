# Radio hourly release gate

Hourly announcements must not be enabled on the production playout service solely because a PR was merged.

## 1. Automated gate

GitHub Actions workflow `Radio hourly playout safety` must be **green** for the merged commit. It validates the continuous PCM Worker syntax and runs the hourly handover, preflight, schedule, cursor, fade and PCM simulation tests. These are not a substitute for real FFmpeg/audio tests.

## 2. Isolated audio gate

On an independent playout process that **cannot publish to production**, exercise all ten scenarios documented in `docs/radio-hourly-pcm-test-plan.md`.

The operator must verify for each scenario:
- Accurate playback of the configured hour asset exactly once.
- No stale PCM packet, leaked second deck, click, or unplanned silence.
- Correct next-track selection and zero offset after a forced handover.
- LIVE priority and hard scheduled programme boundaries.
- Same audible output on web and Windows Agent.

Attach a short PCM/MP3 capture (or an unambiguous listening report), plus journal markers `RADIO_HOURLY_INTERRUPT_ARMED`, `RADIO_HOURLY_PCM_BOUNDARY`, `RADIO_HOURLY_CROSSFADE_PREEMPT`, `RADIO_HOURLY_SIGNAL_PCM`, and `RADIO_HOURLY_SCHEDULED_INTERRUPT_COMMITTED` when applicable.

## 3. Controlled live rollout (requires explicit approval)

Only after both gates are met:

1. Verify all 24 TIME_SIGNAL files and saved configuration.
2. Enable `RADIO_HOURLY_SIGNAL_PCM_ENABLED` on the dedicated test worker. Keep `RADIO_HOURLY_SCHEDULED_PCM_ENABLED` false until AutoDJ scenarios pass.
3. Enable scheduled route separately and repeat tests including transitions.
4. Have immediate rollback to `false` for both environment flags and restart of the relevant isolated unit.
5. Collect before/after audio and logs. Do not interpret the presence of `EMITTED` log alone as proof of an audible signal.

### Rollback principle

If unexpected gaps, replayed snippets, duplicate hour, unapproved boundary or Worker crash occurs, stop the experiment, disable both gates and preserve logs. Do not promote an untested flag to production.
