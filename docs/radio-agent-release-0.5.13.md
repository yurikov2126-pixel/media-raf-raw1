# Windows Radio Agent 0.5.13 — release notes

This release advances the Windows EXE GUI version from 0.5.12 to 0.5.13.

## Included changes

- Incorporates Windows Agent command-admission support from PR #983 for
  explicitly isolated, headphones-only MCHS event-bound ALARM audio.
- Incorporates PR #985's explicit `isolatedTrialSourceAdmission` capability
  in Agent readiness telemetry, allowing the backend to distinguish old Agent
  binaries that reject synthetic commands with `SOURCE_NOT_VERIFIED`.
- No change to public radio authorization, ESP32 amplifier control, or
  emergency PA output. Real/school loudspeakers remain out of scope for
  isolated testing.

## Build and publication

- `AGENT_VERSION='0.5.13'` in `radio-agent/windows/gui.py`.
- The existing `Windows Radio Agent EXE` workflow builds
  `MediaRafRaw-RadioAgent.exe` on Windows, uploads a CI artifact and
  publishes a GitHub Release `radio-agent-v0.5.13` only on a successful
  `main` push with an unused version tag.
- Download and inspect the release asset before replacing the installed
  binary; stop the Agent before updating. Preserve existing user data.

## Isolated headphones pilot

The PyInstaller release entry point is `gui.py`. The operator's separate
`start_mchs_test.py` file is not shipped as an executable entry point by
this workflow. The GUI version number alone does **not** demonstrate that the
pilot is running. For the user-created command-line pilot, update all
`radio-agent/windows/*.py` from the same release commit and keep the custom
launcher, local training WAVs and DPAPI credentials.

Run a new trial only while amplifier AA-300 and PA speaker circuits are
physically disconnected. The previously rejected synthetic event must not
be replayed or represented as successful.
