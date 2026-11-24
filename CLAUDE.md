# EMG Posture Classifier

Detects whether the user is **standing** or **lying down** from surface EMG on the calf
(gastrocnemius/soleus). The calf stays tonically active while standing for balance and is
nearly silent when lying down. Classification uses time-domain + FFT features and a
logistic regression model trained in the browser.

## Files

| File | What it is |
|---|---|
| `game.js` | Tap Brawl, the multiplayer platform fighter loaded by `index.html`. |
| `eyes.js` | Eye control tab: webcam gaze tracking with clicks by foot tap. |
| `race.js` | Sky Race, the multiplayer 3D bird racer (Three.js). Boost = flex intensity. |
| `usc-data.js` | Real USC University Park Campus geometry from OpenStreetMap (© OpenStreetMap contributors, ODbL): buildings with heights, roads/paths, lawns/pitches, stadiums, trees, lamps, benches, fountains, POIs. Origin 34.0205N 118.2855W. Loaded before `race.js`. |
| `la-data.js` | Same format for downtown Los Angeles (about 2,300 buildings up to 335 m, 7,800 road/path ways). Origin 34.0505N 118.2475W. |
| `index.html` | Main web app (no build, no dependencies). Reads the ESP32 over Web Serial, filters, computes FFT features, records labeled data, trains, predicts live, saves/loads models. Open in Chrome or Edge. |
| `esp32_emg_stream/esp32_emg_stream.ino` | Arduino firmware for ESP32-S3. Samples GPIO1 at 2 kHz, prints one 12-bit value per line over USB serial. |
| `amplifier-schematic.html` | Schematic, parts list and design math for the analog front end. Published as an Artifact: https://claude.ai/artifact/PHzTN2T7YtHohTr5mfEKxc |
| `prompt.md` | Reusable project brief to paste into a new AI session. |

## Signal chain

```
Calf electrodes → 10k series R → INA333 (G=11, REF=VREF)
  → Sallen-Key HPF 20 Hz (U1B) → Sallen-Key LPF 500 Hz (U1C)
  → non-inverting gain ×101 (U1D; Rg 1k returns to VREF through Cg 47 µF, so DC gain = 1)
  → 100 Ω → ESP32-S3 GPIO1 (ADC1)
Shin electrode → VREF. VREF = 1.65 V from a 10k/10k divider buffered by U1A.
Single 3.3 V supply from ESP32 3V3 through a 10 Ω + 10 µF + 100 nF filter. Battery only.
```

- Total gain ≈ 1,111 in the passband. Output idles at ~1.65 V ≈ 2,180 raw counts (ESP32-S3 at 12 dB attenuation reads ~0–3.1 V; varies by chip). `cfg.mid` = 2048 is fine because the high-pass removes the DC.
- Cg is required: without it, MCP6004 offsets (up to ±4.5 mV per section) × 101 can shift the output by >1 V.
- U1 = MCP6004 (quad rail-to-rail). U2 = INA333 (MSOP-8, needs a breakout).
- INA333 pins: 1 & 8 = RG (gain resistor only), 2 = −IN, 3 = +IN, 4 = V−/GND, 5 = REF, 6 = OUT, 7 = V+.
- MCP6004 pins: A = 1/2/3 (out/−/+), B = 7/6/5, C = 8/9/10, D = 14/13/12, 4 = V+, 11 = GND.

## Settings that must stay in sync

- **Sample rate**: `FS` in the `.ino` must equal "Sample rate" in the web app (default 2000 Hz). The header pill shows the measured rate and turns orange if it is off by >10%.
- **ADC pin**: must be an ADC1 pin (GPIO1–10); ADC2 conflicts with Wi-Fi.
- **Serial protocol**: plain text, one integer per line (commas also accepted). Baud 921600 (ignored on native USB CDC).
- **Band-pass high cutoff** must be < 0.45 × sample rate (validated in `applyConfig`).

## Web app internals (`index.html`)

- Pipeline per sample: subtract ADC midpoint → 4th-order Butterworth HP + LP (cascaded RBJ biquads) → mains notch + harmonics → ring buffer.
- Every hop (N/2 samples) a window of N samples (default 512 = 256 ms) → `extract()`:
  ln RMS, ln MAV, ln waveform length, zero-crossing rate, mean freq, median freq,
  ln band powers and relative band powers for bands `[lo,50,100,200,hi]`.
- Model: class-balanced L2 logistic regression (`fitLR`), standardized features. Held-out test = last 25% of each recording take (time-contiguous, avoids overlap leakage). Final model is refit on all data.
- Prediction: P(standing), averaged over the last `smooth` windows.
- Persistence:
  - `localStorage['emgPosture.model']`: last trained/loaded model, auto-restored on page load.
  - `localStorage['emgPosture.dataset']`: recorded windows, saved when a take stops.
  - "Save model" downloads JSON: `{type:'emg-posture-logreg', version, trained, cfg, features, mu, sd, w, b, heldOutAcc, ...}`. Loading a model restores its `cfg` so features are computed identically.
  - CSV export/import for raw feature data (first line `# fs=..;lo=..;...`).
- Features are tied to settings via `cfgKey()`. Data/models from different settings are ignored or flagged.
- Demo mode generates synthetic standing/lying EMG for testing without hardware.

### Tabs
1. **Record & Train**: everything above.
2. **Test: FFT vs ML**: compares two detectors built by `train()` from the same data.
   - **FFT rule** (`model.fftRule`, no ML): one FFT-derived feature (total/band/relative power, mean/median freq) + one threshold. `fitThreshold` sweeps thresholds for best balanced accuracy; "auto" picks the best feature. Score = sigmoid(dir·(x−thr)/scale) so it can be smoothed like ML.
   - **ML**: the logistic regression.
   - **Guided protocol**: 5 s lead-in, then alternating postures with spoken cues. The first `settle` seconds of each posture are excluded from accuracy.
   - **Metrics** (`testMetrics`): accuracy, per-class recall, reaction time (first of 3 consecutive correct windows after a cue), missed transitions, false flips. Results export as CSV.
   - In demo mode the simulated posture follows the cues.
   - The guided protocol is `makeTester(opts)`, shared with the Foot tap tab (`PT` = posture, `KT` = tap).
3. **Share live**: everyone streams **raw ADC samples**. Each page classifies every person with its *own* posture model and FFT rule (`peerSamples` runs the full filter → FFT → model pipeline per peer). Nobody reports a status by hand.
   - Topic `emgposture/v2/<room>/sig/<clientId>`, non-retained JSON `{v:2,name,fs,mid,seq,d}` every 250 ms. `d` = base64 of a Uint16Array (~500 samples, ~5 KB/s per person).
   - A peer whose `fs` differs from local `cfg.fs` is shown as "rate mismatch".
   - **Monitoring** (`TRK`, one tracker per person, you included, even outside a room). `trackWindow()` is fed from `onWindow` (you) and `peerSamples` (peers). It keeps:
     - the posture state with hysteresis (0.6 / 0.4), time spent standing or down, and the number of changes
     - a 10-minute per-second timeline
     - a 60 s median-frequency trend
   - **Alerts** are computed locally for everyone. They show as a sticky banner on every tab, with beeps, optional speech and a flashing page title.
     - Possible fall: P(standing) drops from >0.8 to <0.2 within `alFallWin` s, then stays down for `alConfirm` s.
     - Inactivity: down for longer than `alInactive` minutes.
     - Standing up clears a fall alert. Calf EMG can't tell sitting from lying, so a fast sit-down can also trigger a fall alert.
   - **Fatigue test** (`FAT`): records (t, median freq, RMS) for a chosen person, you or a peer. Windows below 30% of the median RMS are dropped as rest. A linear fit gives the slope in Hz/s, % per minute and R². Exports CSV.
     - The demo state `raise` simulates a tiring calf: the band shifts about 45% lower over 60 s.
4. **Foot tap**: separate dataset/model (`TAP`, localStorage `emgPosture.tapDataset` / `emgPosture.tapModel`, file type `emg-tap-logreg`). Classes `tapping` / `still` while seated (heel taps use the calf).
   - Features = the 14 posture features + std, range and mean of ln RMS over the last 8 windows.
   - `TAP.state` (ML or FFT rule, chosen with `kMethod`) gates the fast 32 ms envelope detector `envBlock()`. That detector fires one `emgtap` window event per burst onset, with a 150 ms refractory period.
5. **Tap Brawl** (`game.js`): online platform fighter. Keyboard moves the fighter; an `emgtap` event (or J, if enabled) attacks.
   - 9 **original** fighters in `ROSTER`, drawn procedurally on canvas. Don't replace them with characters from existing franchises.
   - Network topics under `emgposture/v1/game/<room>/`: `s/<id>` = state at 20 Hz; `h/<victimId>` = hit (QoS 1, the attacker detects hits and the victim applies knockback); `c` = match start `{type:'start',m,ids}`.
   - Each client simulates only its own fighter. Remote fighters are extrapolated and smoothed. 3 stocks; last fighter standing wins.
   - 6 original arenas in `ARENAS` (Sky Ruins, Twin Peaks, Floating Isles, Cloud Ferry, Frozen Lake, Ember Tower), each with its own platforms, spawn points, respawn point, `grip` (ice = 0.22) and background decoration.
     - Moving platforms are timed by `Date.now()`, so every client sees them in the same place. Fighters standing on one are carried by its `dx`.
     - Picking an arena publishes `{type:'arena',a}` on `c` so the whole room switches. The start message carries `a`.
   - `game.js` talks to the page only through `window.EMG` (`loadMqtt`, `randCode`, `broker`, `name`, `tapReady`, `activeTab`, `css`).
6. **Flex intensity** (in `index.html`, `FLEX`): regression of effort 0–100% from the same windows. localStorage `emgPosture.flexDataset` / `emgPosture.flexModel`, file type `emg-flex-ridge`.
   - Features = the 14 posture features + linear RMS (`flexFeat`). Labels are the calibrated levels 0/0.25/0.5/0.75/1.
   - **ML** = standardized ridge regression (`fitRidge`, λ = 0.03·n, solved with `solveLin`). **RMS curve** (no ML) = median linear RMS per level, forced monotonic, interpolated (`fitCurve`/`predictCurve`). Held-out = last 25% of each take; reports MAE and R².
   - Guided calibration (`flexCalStart`/`flexCalTick`): 3 s lead-in, then each level for `xDur` s per round, first `xSettle` s not recorded, then trains automatically. In demo mode the `flex` demo state follows the cue; the `demoFlex` slider sets the simulated level.
   - Live output `FLEX.level`: chosen method → dead zone → EMA (`xTau`). Exposed as `window.EMG.flex()` → `{ready, level, method, trained}`.
7. **Sky Race** (`race.js`): 3D bird racing. Keyboard steers (arrows/WASD, R = back on course); boost = `EMG.flex().level` (Space = keyboard boost if enabled).
   - Three.js **0.160.0** ES module, dynamically imported from jsDelivr the first time the tab opens (needs internet, like WebGazer). Nothing else external besides MQTT.
   - 9 **real bird species** in `BIRDS` (stats spd/acc/hnd/boost/stam, `tough`, `quick`; `look` drives the procedural model in `buildBird`). Keep them real birds; no characters from existing games.
   - 3 original courses in `COURSES` (Coastal Cliffs, Red Rock Canyon, Aurora Fjord): Catmull-Rom loop of `pts`, procedural terrain carved below the course (`carve`), sky/water shaders, trees, clouds.
   - Performance: `adaptScale` lowers the render pixel ratio when frames take >25 ms and raises it again (capped) when they take <19 ms. Trails and speed lines write straight into their buffers (no per-frame allocations). Detail that costs no triangles: terrain grain/strata in a patched fragment shader (`q.detail`), two rings of distant mountains (`buildHorizon`, follow the camera), shore colour + foam in the water shader from a 512² depth `DataTexture`, shaded cloud puffs, and 65% of trees placed within ~380 m of the course.
   - **Real-map cities** (`usc` USC Campus and `la` Downtown Los Angeles; `co.usc` flag + `co.data` = `'USC_DATA'`/`'LA_DATA'`): built by `buildUSC` from OpenStreetMap files `usc-data.js` and `la-data.js` (regenerate from Overpass with a converter that writes `{o,gr,b,r,a,st,tr,pl,l,bn,fo,art,bs,poi}`; buildings can have courtyard holes `hl` from OSM multipolygon relations, which is where Doheny Library, Mudd Hall and the Medicine Crow Center (ex Von KleinSmid) come from; local metres, x east, z south). `uscPrep(co)` indexes buildings into a 32 m spatial grid per dataset (cached in `UC`); `bAt(x,z)` returns the tallest building at a point. **Looks** come from `uscStyle` + `USC_STYLE` (per-building overrides researched from USC/LA Conservancy sources: Romanesque Revival brick with limestone trim, arched windows, clay-tile roofs, Bovard/Mudd Hall towers, globe-topped Medicine Crow tower with a 10-pillar arcade, Coliseum peristyle and torch) and shader wall kinds `aKind` 1 punched, 2 parking, 3 glass, 4 brick+arches, 5 ribbon, 6 stucco, 7 concrete slots, 8 tile roof. Rectangular footprints get gable/hip roofs (`rf`, collision height `h` = wall `hw` + 0.85×rise). Towers/crowns/colonnade/peristyle go through `xAdd` into one merged mesh. **Performance**: buildings and trees are split into 320–420 m tiles (frustum culling + shadows per tile), palm fronds are 8-triangle cones (they were 560-triangle spheres: ~2.6M → ~0.35M triangles per frame), city terrain uses a 72² grid, fountains/statues are instanced, people/cars far from the camera are not updated. Ground = canvas painted from roads/paths/lawns (+ crosswalks, lane dashes, grain); buildings = one merged mesh, with windows, cornices, parking slits and glass curtain walls (`aKind` 3, towers ≥46 m) drawn in the shader (`aUV`, `aKind`, `aH`), hip roofs on small houses, rooftop units, crowns and masts on towers. Street furniture (`buildUscProps`): lamps, benches, bus shelters, fountains, statues. Instanced trees/palms, walking people and cars on the real roads. Landmarks use `by:` (building name, `@Tommy`, `@st:`, `@pl:`).
     - **Texture over geometry**: trees/palms are crossed painted-leaf cards (`leafTexture`, `palmTexture`, `cardGeo`, 16 triangles); street furniture are merged multi-part kits (`furnitureKits`: benches with slats, lamps, bins, bike racks, planters, café tables with umbrellas, bus shelters, tiered fountains, statues). `makePool` keeps every item's matrix in a typed array and copies only items within a radius of the camera into one instanced draw call (one call per kind). Wall shader adds base AO, eave shading, grime, doors, window glow at night (`uNight`, globals `gW`/`gC`) and roof gravel; the ground shader adds grain, mown stripes and paving joints from world position; the Coliseum bowl has arches, seat rows and aisles (`stadiumMaterial`).
     - **Time of day + weather** (`ENV`, `applyEnv`, city maps only; selects `rTod`, `rWeather`, saved in `emgPosture.env`): keyframed sky/fog/hemisphere colours by hour (`TOD_KEYS`), sun/moon direction and colour, stars, night windows and lamps; `Live cycle` runs a day in 6 minutes. Weather: overcast greys everything, rain adds `LineSegments` drops and rain hiss, fog shortens the fog range.
     - **Missions** (`MISSIONS`, `startMission`, key M or the Missions panel): ring tours over landmarks and 10-ring street runs; gold/silver/bronze times, best times in `emgPosture.missions`; compass and minimap mark the next ring.
     - **In-game flex calibration**: button or key F runs the Flex intensity tab's guided routine through `window.EMG.flexCal` and draws the cue/target bar over the game (`drawCalOverlay`).
     - **Name labels** (`buildUscLabels`/`updateLabels`): 16 pooled sprites; every 0.25 s the nearest in-view sources (named buildings, places, cafés, artworks, streets) get a label painted on a fixed 512×64 canvas.
     - **People startle** (`updateUsc`): a pedestrian within ~12 m + 0.34×speed of the bird (bird under 46 m) runs away along its path for 3–5 s, arms up, with a hop.
     - Roofs count as ground (`groundAt` = max(terrain, roof)); flying into a wall slides you out (`uscPush`). There is no landing/walking (removed for performance). The camera is pulled out of buildings rather than lifted onto roofs.
   - Track = `M`=1200 samples with frames P/TG/S/U. Progress = lap + idx/M; laps count when crossing idx 0 after passing the halfway checkpoint. `TUBE` = soft course radius; far off course → respawn.
   - Obstacles placed from the course seed (same for everyone): rock, orbit (moving), balloon (bobbing), turbine (spinning blades), pillar, storm (slow zone). Moving ones are timed by `Date.now()`. Golden rings = updraft (+speed, +stamina).
   - Boost drains stamina; exhausted until it refills to 35%. Rocket start: flex level 45–75% at GO; >90% stalls.
   - Solo races add computer birds (`botInput`, light rubber-banding). Room races have no bots.
   - Network topics under `emgposture/v1/race/<room>/`: `s/<id>` = state at 15 Hz `{n,c,x,y,z,yw,pt,rl,v,b,g,l,f,m}`; `c` = `{type:'start',m,ids,k,laps}`, `{type:'course',k,by,n}`, `{type:'fin',m,id,n,time}`. Each client simulates only its own bird; remotes are extrapolated and smoothed.
   - **Controls** (`ctrl`, select `rControl`): `all` = keyboard + eyes + flex (keys win over gaze while pressed), `kb` = keyboard only (flex ignored, Space boosts/flaps), `eyes` = hands-free (gaze steers, flex = speed, keys ignored). Gaze steering (`gazeSteer`) reads `EyeControl.gaze()`: offset from the view centre outside a 14% dead zone → turn / climb, scaled by `rEyeSens`. While eye-steering on this tab, `eyes.js` hides its cursor and foot taps don't click buttons (`SkyRace.eyeSteering()`).
   - **Travel mode** (`mode='travel'`, select `rMode`): no laps, bots, gates or crashes. `stepTravel`: flex = flapping effort (glide at 0), diving gains speed, climbing costs it, ground = soft bounce, world edge turns you back, solid things push you aside. Race-only meshes live in `W.raceG`, travel-only ones in `W.travelG` (`applyModeVis`).
     - 5 landmarks per place in `LANDMARKS`, placed by rule (`WHERE`, then `LOOSE`, then any flat spot) away from the course; models in `LM_BUILD`. Flying within `L.rad` discovers one; found names persist in localStorage `emgPosture.travel` and show in the Travel journal panel.
     - Ambient: flocks (instanced wings), boats, rising warm air columns (`W.thermals`, lift you), chimney/campfire smoke, drifting clouds, boulders/shrubs, a hill-shaded minimap (`buildMapImg`), compass with landmark markers.
     - A room `start` message switches everyone to race mode.
   - Keys: C camera (chase/wide/side), H hide HUD, P photo (PNG download with a caption; optionally on foot tap in travel, `rTapPhoto`). Ambient WebAudio (wind follows speed, surf near the sea, bird calls) behind the `rSound` checkbox; starts on the first key/click in the view.
   - `window.SkyRace` exposes state and helpers for tests (`setMode`, `stepTravel`, `eyeSteering`, `takePhoto`, `LANDMARKS`).
8. **Eye control** (`eyes.js`): webcam gaze tracking with WebGazer 3.3.0, lazy-loaded from jsDelivr. Its face models come from tfhub.dev, which redirects to Kaggle storage.
   - Video is processed locally. `saveDataAcrossSessions(true)` keeps calibration between visits.
   - Mouse training listeners are removed. Only the 13-dot calibration trains the model: 3 foot taps or clicks per dot, 8 samples each, taken 140 ms after the tap so the eyes have settled. A 3 s centre-dot check then measures the error in px and stores the centre offset (`S.bias`, capped at 15%) that is subtracted from later readings.
   - Filtering in `onGaze`: median of the last 5 samples (blink spikes) → bias removal → One-Euro filter (`OneEuro`, resting cutoff = 3.2 / Smoothing, beta 0.006). WebGazer's own Kalman filter is off. Successful clicks within 70 px of the gaze feed 3 extra samples back into the model (`eyLearn` checkbox). The hover scan runs every 70 ms, not every frame.
   - An `emgtap` event (or K, if enabled) clicks the element under the smoothed gaze. With snapping on, it clicks the nearest visible button/checkbox/select within N px instead. This works on every tab except Tap Brawl.
   - Target practice: 10 targets; reports misses, click accuracy, time per target and gaze error.
   - A page cannot move the OS mouse pointer, so eye control stays inside the page.
- CSS has a global `[hidden]{display:none!important}`, because `.row{display:flex}` would otherwise override `hidden`.
- Real-browser testing works with playwright-core and the installed Chrome (`--use-fake-device-for-media-stream` for the camera; `--use-angle=swiftshader --enable-unsafe-swiftshader` for WebGL in headless mode, ~6 fps).
- mqtt.js 5.10.1 is lazy-loaded from unpkg **only** when joining a share room or arena.
- Names from other people are rendered with `textContent` or canvas `fillText` (untrusted input). Numeric fields are clamped.
- Model JSON is `version: 2` (adds `fftRule`, `fftHeldOutAcc`). v1 models still load but need one retrain for the test tab.

## Conventions

- Keep `index.html` a single self-contained file. Everything except live sharing, eye control and Sky Race must work offline from `file://`. External libraries are lazy-loaded only by the tab that needs them (MQTT, WebGazer, Three.js).
- If the feature vector changes, bump the model `version` and keep `featureNames()` in the same order as `extract()`.
- Test JS changes headlessly: extract the `<script>` block and run `node --check`. For logic, stub `document`/`localStorage` and feed demo samples through `processSample()`.
- Safety: never suggest powering the electrodes from anything mains-connected.

## Added later (summary)
- **Files**: `brawl3d.js` (Tap Brawl 3D view, Three.js, lazy; game.js feeds it bodies/projectiles/particles and draws name tags + HUD on the 2D canvas above it; checkbox `gView3d`), `hands.js` (optional hand gestures for Sky Race travel: MediaPipe Hand Landmarker lazy-loaded from jsDelivr, model from Google storage; open hand = flap, fist = glide, hand position = steer relative to a neutral spot, pinch = bird call; `rHand` select), `sounds-data.js` (real bird calls cut from xeno-canto recordings, credits in `sounds/CREDITS.txt`; CC BY-NC-SA mostly, so keep the project non-commercial).
- **Bird sounds**: `playCall` plays a random excerpt of the recorded clip (`playRealCall`, decoded on first use) and falls back to the synthesised `CALLS`. Switching birds runs `stopBirdSounds()` (silences the old bird's call and wing hum) and the new bird calls once. Keys: B = call.
- **Fullscreen**: Sky Race (`G`, button), Tap Brawl (`#gFull`), eye target practice (`#eyArenaFull`) via `data-fs`. Only the fullscreen element is drawn, so `eyes.js` (`adoptFs`) moves the gaze region, calibration layer and webcam preview into it. In Sky Race fullscreen a corner Menu button (look at it ~1 s, or tap while looking at it, or press `O`) opens a big-button menu; steering stops and dwell selection is forced on while it is open.
- **Eye tracking**: gaze is a *region* (radius from jitter over the last second + calibration error; `eyRegion`, `eyRegionScale`); buttons are chosen by overlap with the region (`pickRegion`), candidates get a dashed outline, the best a solid one; optional dwell click (`eyDwell`, `eyDwellMs`). Calibration: optional tap-free mode (`eyAuto`), then a 5-point check fits an affine correction (scale + offset per axis, saved in localStorage `emgPosture.eyeMap`); predictions are shifted when the window moves or goes fullscreen (`viewFrame`); confident clicks nudge the offset; time-based median filter; tracking-quality tips (brightness, face size/position, fps). Sky Race steering dead zone grows with the region radius.
- **Fonts**: DM Sans + Fraunces from Google Fonts when online (system fallbacks offline); HUD canvas text uses DM Sans.
- **USC scale**: on real-map cities the bird is 0.55× and the camera 0.62× as far, speeds ×1.0 (was 0.72) (`CITY_BIRD`).
- **Interactive calls** (`interactCall`, key B tap/hold, click on the view, hard flex, hand pinch): short excerpt on tap, long on hold (`playRealCall` opt `long`), Shift/Ctrl change pitch, volume follows your flex. Other birds answer from a random side (`scheduleReplies`, gold arcs on the HUD), people within ~45 m look up and wave (`w.greet`), pigeons scatter (`scatterPigeons`). Pigeons (`buildUscPigeons`), cyclists (`buildUscBikes`), cardinal/gold flags (`buildUscFlags`), jacaranda trees, cardinal/gold awnings, water shimmer and stadium yard lines were added to the USC map. `rBirdSize` (Tiny/Small/Medium/Large) sets the bird size on city maps.

- **Reaction sounds** (`emote(kind,power)` in race.js): `roar` when flex crosses 0.7 upward (3.5 s cooldown; pitch-bent, distorted long clip, lower for big birds), `ouch` on crashes, bumps and ground hits (short clip with a falling pitch bend plus a feather puff). Both use the current bird recording and are silenced by `stopBirdSounds`.
- **USC round 3**: only the current bird ever makes sound (ambient and reply calls use `me.c`). Roof/street Trojan flags: `buildUscFlags` = up to 420 instanced poles + one instanced cloth with a painted SC texture and a vertex-shader wave. `addLayers` adds base course, belt courses, cornice, parapet and rooftop step-back to rectangular buildings (merged extras). Labels are painted signage (`paintLabel`: cardinal plaque with floors/height, green street sign, park sign, small tags, tail pointing at the target). Ground: soft lawn mottling on the canvas, smooth value-noise detail (`vn`/`fbm`) in the shader instead of hard texel noise, AA paver joints; leaf cards are 512 px. **Travel together**: room state carries the course `k`; a newcomer lands on the room map; name tags with distance, edge arrows to off-screen friends, emotes (keys 1-5) and call bubbles over friends (`${base}/e` topic), T flies to the nearest friend, "Copy invite link" (`#sr=ROOM&course=..&mode=travel` auto-joins).
- **USC landmarks**: `LM_BUILD.usc` has a detailed Tommy Trojan (stepped pedestal with bronze relief panels and plaques, crested helmet, pleated skirt, belt, greaves, sword point-down, Shield of Courage, cardinal/gold paving ring) and the Shumway Fountain (landmark `by:"@fo:Hahn Plaza"` = nearest OSM fountain). The beam starts above them. Street `K.statue` and `K.fountain` kits are bigger and more detailed.
- **Real scale on cities**: `cityBirdScale(r)` draws each bird at its real wingspan x 2.2 at "Small" (`REAL_SPAN`: peregrine 1 m, eagle 2 m, hummingbird 14 cm, swallow 34 cm...) so buildings, houses, statues and trees tower over it; the Bird size menu multiplies that (Tiny 0.64x, Medium 1.45x, Large 2.2x). Camera sits closer (`sk`), collision radius uses 0.7x `citySize()`.
