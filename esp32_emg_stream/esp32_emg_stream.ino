// ESP32-S3 EMG streamer
// Samples one ADC pin at a fixed rate and streams raw 12-bit values
// over USB serial, one number per line. Works with emg-posture/index.html.
//
// Arduino IDE: Board = "ESP32S3 Dev Module", USB CDC On Boot = Enabled
// (if you use the native USB port). Baud is ignored on native USB, but
// set the website to 921600 anyway.

const int      EMG_PIN   = 1;        // GPIO1 = ADC1_CH0. Use an ADC1 pin (GPIO1-10); ADC2 conflicts with WiFi.
const uint32_t FS        = 2000;     // sample rate in Hz (must match "Sample rate" on the website)
const uint32_t PERIOD_US = 1000000UL / FS;
const int      BATCH     = 20;       // samples per Serial.write (fewer USB calls = steadier timing)

char     buf[BATCH * 6 + 8];
int      bufLen = 0;
int      count  = 0;
uint32_t nextUs;

void setup() {
  Serial.begin(921600);
  analogReadResolution(12);                 // 0..4095
  analogSetPinAttenuation(EMG_PIN, ADC_11db); // ~0..3.1 V input range
  nextUs = micros();
}

void loop() {
  // wait for next sample tick (busy-wait gives much less jitter than delay())
  while ((int32_t)(micros() - nextUs) < 0) { }
  nextUs += PERIOD_US;

  // if we fell far behind (e.g. USB stalled), resync instead of bursting
  if ((int32_t)(micros() - nextUs) > (int32_t)(10 * PERIOD_US)) nextUs = micros() + PERIOD_US;

  int v = analogRead(EMG_PIN);
  bufLen += snprintf(buf + bufLen, sizeof(buf) - bufLen, "%d\n", v);

  if (++count >= BATCH) {
    Serial.write((const uint8_t*)buf, bufLen);
    bufLen = 0;
    count  = 0;
  }
}
