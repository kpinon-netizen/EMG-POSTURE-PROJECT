# Project Prompt: EMG Standing vs Lying Classifier

Paste this into a new AI session to give it full context on the project.

---

I'm building a surface EMG system that detects whether I'm **standing** or **lying down**,
using machine learning and the Fourier transform.

## Hardware
- **Electrodes:** 3 Ag/AgCl gel electrodes. Two go on the calf muscle belly (gastrocnemius/soleus), about 2 cm apart. The reference electrode goes on the shin bone and connects to VREF.
- **Analog front end:** my own build on a single 3.3 V supply.
  - **INA333** instrumentation amp. RG = 10k, gain 11, REF = VREF. The 10k RG resistor sits between pins 1 and 8.
  - **20 Hz Sallen-Key high-pass:** 100 nF ×2, 56k to the output, 110k to VREF.
  - **500 Hz Sallen-Key low-pass (anti-alias):** 10k ×2, 47 nF feedback cap, 22 nF to VREF.
  - **Non-inverting gain ×101:** Rf 100k, Rg 1k in series with a 47 µF cap to VREF (AC-coupled, so op amp offsets aren't multiplied by 101).
  - **Output:** 100 Ω series resistor, then the ESP32-S3 on GPIO1.
  - **VREF = 1.65 V:** a 10k/10k divider plus 10 µF, buffered by MCP6004 op amp A.
  - **Op amps:** stages A–D all use one MCP6004 quad. Total gain is about 1,111.
- **Microcontroller:** ESP32-S3 samples at 2 kHz and streams raw 12-bit values over USB serial, one number per line.
- **Power:** battery only, for safety.

## Software
- **Web app (`index.html`)**, a single HTML file using the Web Serial API in Chrome or Edge. It does:
  - Band-pass 20–450 Hz plus a 60 Hz notch.
  - 512-sample windows with 50% overlap.
  - Features: RMS, MAV, waveform length, zero crossings, and from the FFT (Hann window) the mean frequency, median frequency and band powers.
  - Labeled recording and in-browser logistic regression, tested on a held-out portion of each take.
  - Live prediction with smoothing.
  - Model saving to JSON and localStorage, plus CSV export/import.
  - A **Test** tab that compares an FFT-only threshold rule against the ML model, with a guided stand/lie protocol.
  - A **Share** tab that streams raw EMG to other people over MQTT. Each page classifies everyone's posture with its own model.
  - A **Foot tap** tab: a separate tapping-vs-still model (ML vs FFT rule) for when I'm seated, with its own live test.
  - **Tap Brawl** (`game.js`): an online platform fighter with 9 original creatures. You move with the keyboard and attack by tapping your foot.
  - A **Flex intensity** tab: a guided calibration at 0/25/50/75/100% effort trains a ridge-regression model (vs. a simple RMS curve) that outputs how hard I flex, 0–100%.
  - **Sky Race** (`race.js`): an online 3D bird game (Three.js) with 9 real bird species. Controls: keyboard only, eyes + flex (hands-free: webcam gaze steers, flex sets speed), or all three. Race mode: flex = boost. Travel mode: free exploration with landmarks to discover, flocks, boats, rising warm air and ambient sound; flex = flapping.
- **Firmware:** `esp32_emg_stream/esp32_emg_stream.ino`.
- **Main research question:** is a simple FFT rule as good as machine learning for detecting posture?

## What I want help with
<!-- Replace this with your current question, for example: -->
- [ ] Debugging the hardware signal (noise, saturation, 60 Hz hum)
- [ ] Improving classification accuracy (more features, a different model, more classes like sitting)
- [ ] Analyzing exported CSV data in Python
- [ ] Writing up the project (report or presentation)

## Constraints
- Explain electronics clearly; I'm still learning circuit design.
- Keep the web app as a single self-contained HTML file with no libraries.
- Keep the sample rate in the firmware and the web app in sync.
- Never suggest anything that connects the electrodes to mains power.
