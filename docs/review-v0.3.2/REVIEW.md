# v0.3.2 screen checks

Captured from the built app in Playwright at 390 × 844 (English/light) and 320 × 740 (dark, including Urdu). These are browser views of the app, not Android service screenshots.

1. **Qibla — improved; physical sensor unverified.** One direction arrow, a north dial, clear bearing and a plain no-sensor message. The controls are shown separately after scrolling. The native sensor still needs calibration and a real-phone comparison.

   ![Qibla](01-qibla.png)
   ![Qibla controls after scrolling](01b-qibla-controls.png)

2. **Settings and location — checked.** The five-choice menu fits one phone screen. Location exposes the city and main actions first, with extra fields under More location options. Back returns to the list before Home.

   ![Settings](02-settings.png)
   ![Location settings](03-location.png)

3. **Dua editor — checked.** The reading section opens by default and includes text, a new-file upload and a saved-file selector. The browser regression saves text and a PDF attachment, reloads, reads the text, and verifies both values in the editor. It does not test Android PDF rendering. Narrow date fields use one column to avoid clipping.

   ![Dua text and file controls](04-dua-editor.png)
   ![Narrow Urdu form](07a-routine-urdu-dark-320.png)
   ![Urdu reading controls in dark mode](07-dua-urdu-dark-320.png)

4. **Personal repentance — checked in preview.** Add activity is visible at the top. Saving opens the activity list, and a new activity can be completed without a habit or slip. Private preview entries remain session-only; Android encrypted persistence is outside this browser check. The existing habit-to-penalty flow also passes its regression.

   ![Saved personal activity](05-repentance.png)

5. **Travel — checked.** At 320px, the action buttons stack with a gap, and the explanation sits below them. Choose location opens the relevant settings category directly.

   ![Travel at 320px in dark mode](06-travel-dark-320.png)

Keyboard Back-event tests cover modal closing, settings categories and prayer detail pages. There is no horizontal page overflow in the tested small layouts. These checks are not a complete accessibility certification. Hardware Back, compass readings, screen overlays, notification audio and delivery after process death require a phone; see [release test steps](../V0.3.2-FIXES.md).
