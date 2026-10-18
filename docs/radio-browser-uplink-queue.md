# Radio 2.0 — Browser Opus uplink transport integrity

This is still **validation-only**, not live broadcast. The browser WebM/Opus pilot does not feed PCM, the station encoder, amplifiers, relays or ESP32.

## Changed behavior

- Every non-empty MediaRecorder chunk is appended to a bounded FIFO (up to 8 waiting chunks, plus one in flight), rather than discarded while waiting for the preceding Socket.IO acknowledgement.
- Exactly one chunk is in flight. The next sequence number is assigned only after successful ACK, so binary chunks preserve order.
- A missing ACK after 5 seconds, a chunk over 128 KiB, a full queue, a failed acknowledgement or disconnected socket fails closed: stop the recorder, clear the pending queue and request session termination.
- Recorder and socket cleanup is also triggered by leaving the studio or unmounting the component.

## Isolated manual verification

1. Keep production flags off; use an isolated staging setup with headphones only, disconnected from school PA/amplifier/ESP32.
2. Turn on RADIO_BROWSER_OPUS_UPLINK_ENABLED=true only for the isolated pilot.
3. Log in as the authorized admin presenter, start the microphone and press “Тест передачи Opus”. Confirm the acknowledged chunk count increases, and the queue remains bounded.
4. Throttle or disconnect Socket.IO and verify the pilot stops with an error rather than silently skipping chunks.
5. Stop and restart the pilot and verify that sequence numbering starts over and there are no zombie recorder sessions.

## Not implemented by this change

Streaming FFmpeg/WebM decoding in the authenticated gateway, jitter/loss concealment, PCM handoff, station source arbitration, MP3 encoder insertion, production broadcasting, and device failover remain future isolated stages.
