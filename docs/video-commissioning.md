# Video commissioning and remaining production gates

GW-V01 reports persistent image degradation, not proof that the camera is compromised.
The ML novelty score remains visible even when no quality alert is generated. A
statistical anomaly alone must not turn ordinary motion or increased clarity into
a security warning.

## Commission each camera

1. Fix camera position, resolution and sampling rate (5 FPS capture, 1 telemetry/s).
2. Calibrate with normal lighting, people and motion. Keep training and validation
   frames separate. Do not train on obstruction or an already degraded scene.
3. Inspect the saved model card: validation sample count, anomaly rate and longest
   streak; retain its version and backup. Failed validation must preserve the active model.
   Older camera artifacts without a successful separate validation report must be
   recalibrated before starting the updated webcam agent. Capture has an enforced
   process timeout (255 seconds for the default calibration).
4. Observe normal operation across representative lighting conditions, not only the
   calibration's 30-second holdout. Measure false quality alerts per hour and raw ML
   novelty separately. Agree the acceptable rate before deployment.
5. Test obstruction, strong illumination and defocus with operator supervision.
   Measure detection/recovery times and missed detections. Low motion alone is not
   a replay detector; this implementation does not claim replay detection.
6. Review historical GW-V01 alerts separately. Changing the policy does not delete
   or silently resolve incident-linked evidence. Restore only after operator review.

## Deployment gates

Passing synthetic regressions and one webcam calibration is not production acceptance.
The current application still uses a shared demo admin token, a local Vite process
helper, HTTP services and single-worker in-memory video streaks. Production requires
managed service lifecycle, individual authorization, transport security, monitoring,
an agreed retention policy and recovery/restart tests. One configured agent must own
each device stream; the sample-count policy assumes one telemetry sample per second.
The three global visual features cannot establish malicious intent and cannot cover
all image failures. A real deployment needs a representative camera evaluation set.

Do not raise thresholds until an example turns green, auto-learn anomalous scenes,
or suppress telemetry to pass acceptance. Record failed acceptance and investigate
scene drift, capture settings and source identity.
