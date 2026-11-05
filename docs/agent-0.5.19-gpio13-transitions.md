# Windows Agent 0.5.19 — evidence for GPIO13 dropouts and manual ON

The purpose of this patch is to **measure the failure before changing mains
control**. It does NOT hold the relay ON despite revoked server authorization
and does NOT bypass ESP32 HMAC, lease expiry, heartbeat, or HALT.

## Known behavior of v0.5.18

- The two synthetic sounds (danger and all-clear) are **separate events**.
  On natural completion the local controller leaves PLAYING, and the GPIO13
  synthetic audio gate returns OFF until the next pre-roll. Therefore
  OFF between danger and all-clear can be expected.
- If GPIO13 drops **while the same WAV is still PLAYING**, this must be
  diagnosed. Potential causes include server `permit:false`, a local policy
  state transition, an error in signed power requests, Wi-Fi loss or expiry
  of the ESP32 eight-second lease. Do not infer which without evidence.
- The checkbox **Аппаратное испытание GPIO13** is an authorization, not
  an ON switch. The bounded manual test button requires a running and armed
  isolated Agent **and** the existing administrator policy
  `Усилитель · ESP32 → Вручную → Запрос ВКЛ` with `permit:true`.
  The button itself does not modify the server's permission.

## New evidence

`%LOCALAPPDATA%\MediaRafRaw\RadioAgent\logs\power-diagnostics.log` now
records `RELAY_TRANSITION` on an acknowledged change, with:

- `OFF_AUDIO_BOUNDARY`: synthetic WAV no longer playing.
- `OFF_SERVER_DENIED`: the central authorization does not permit ON.
- `OFF_TRIAL_EXPIRED`: the isolated 10-minute test window elapsed.
- `OFF_AGENT_STOP`: Agent stopped.
- `OFF_LOCAL_POLICY`: other local gate.
- `ON_REQUESTED`: accepted signed ON.
- `POWER_ERROR`: no ESP32 acknowledgment; distinguish from confirmed OFF.
- `MANUAL_ON_REQUESTED` and `MANUAL_ON_DENIED`: show if operator requested
  the bounded test and the server's safe reason for rejecting it.

No token, HMAC, secret, raw HTTP request or full URL is logged.

## To inspect without repeating an unsafe test

Stop amplifier power tests. With PA/amp safe and the Agent closed or in
non-power mode, read the existing log (do not need to generate a new alarm):

```powershell
$log=Join-Path $env:LOCALAPPDATA 'MediaRafRaw\RadioAgent\logs\power-diagnostics.log'
Get-Content $log -Tail 180 | Select-String 'POWER_COMMAND|POWER_ERROR|INTENT_RESPONSE|INTENT_ERROR|RELAY_TRANSITION|MANUAL_'
```

Interpret the existing v0.5.18 log first. If OFF/ON is between two separately
completed synthetic events, it is a deliberate event boundary, not proof of
network failure. If it happens in the middle of PLAYING, check sequential
timestamps and recorded `permit`/reason/error. For a hardware-only power
safety test, require a qualified electrician to confirm the mains circuit.

## Boundary

Actual relay feedback requires dedicated physical measurement. An ESP32
`ON_COMMANDED` acknowledgment is not evidence of power delivery to AA-300.
Production PA and real Android-to-PA remain unauthorized.
