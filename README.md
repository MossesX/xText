# xText

**xText reads your incoming messages aloud and lets you reply by voice, without touching your phone.**

Built for driving, cycling, cooking, working out, or any time your hands and eyes are busy.

- Reads **SMS** the moment they arrive, and **WhatsApp, Telegram, Signal, Messenger, RCS (Google Messages)** and any other messaging app through notification access.
- After each message asks *"Reply, repeat, or ignore?"* and listens.
- Say **"Reply"** and dictate, or say it in one go: *"Reply saying I'm on my way"*.
- Reads your reply back and sends it when you say **"Send"**. Say **"Change"** to re-dictate or **"Cancel"** to drop it.
- Replies go back the way they came: SMS as SMS (on the same SIM), app messages through the app's own reply action.
- **"Call back"** phones the sender (optional). **"Stop"** silences everything.
- Works on Bluetooth headsets and car kits, including their microphone.
- Zero third-party dependencies and nothing leaves the device except the messages you send.

## Hands-free flow

```
📩 New message
🔊 "WhatsApp message from Sam: are we still on for 7? Reply, repeat, or ignore?"
🎤 "reply saying yes see you there"
🔊 "Your reply: Yes see you there. Send it?"
🎤 "send"
🔊 "Sent."
```

Stay silent after a message and xText simply moves on.

### Voice commands

| After a message is read | When your reply is read back |
|---|---|
| **reply** / **respond** / **answer**, then dictate | **send** / **yes** / **ok** |
| **reply saying …** / **tell them …** (one-shot reply) | **change** / **try again** / **change it to …** |
| **repeat** / **say that again** | **cancel** / **no** / **never mind** |
| **read more** (long messages) | |
| **call back** (if enabled) | |
| **ignore** / **skip** / **no** / silence | |
| **stop** (stop reading, clear the queue) | |

## Settings

Everything is on the single settings screen:

- **What to read**: SMS, other apps, full text or sender only, contact names, contacts-only, announce the app, maximum length.
- **When to read**: always, only when the screen is off, or only with headphones / Bluetooth / in a car.
- **Quiet hours**: a daily window during which nothing is read.
- **Voice**: speech rate, voice replies, read-back confirmation, on-device recognition, Bluetooth microphone, call back.
- **Messaging apps to read**: pick from installed apps or add any package name.
- **Blocked senders**: names or numbers that are never read aloud.
- **Activity**: a log of what was read, heard and sent, so you can tune the setup.

The persistent notification has **Pause 30 min / Resume**, **Reply to last** and **Stop** actions.

## Building

Requirements: Android Studio (Ladybug or newer) or a JDK 17 plus the Android SDK with platform 36.

```sh
./gradlew assembleDebug        # app/build/outputs/apk/debug/app-debug.apk
./gradlew testDebugUnitTest    # unit tests for text cleaning, command parsing, quiet hours
```

A GitHub Actions workflow (`.github/workflows/android.yml`) builds the debug APK and runs the unit tests on every push, and uploads the APK as a workflow artifact.

Install the APK, open xText, tap **Start xText**, grant the permissions it asks for, and turn on notification access when prompted. Use **Try it with a sample message** to hear the whole flow before a real message arrives.

## If the SMS permission cannot be granted

Android treats SMS permissions as *restricted*. When an APK is sideloaded, some installers do not allow-list them, so the permission prompt never appears and the toggle under *App info > Permissions > SMS* is missing or greyed out. Two ways around it:

1. **Use notification access instead.** Turn on *Notification access* for xText and keep your SMS app (Google Messages, Samsung Messages) ticked under *Messaging apps to read*. Texts are then read from the SMS app's notifications and replies go back through the same app. No SMS permission is needed for this.
2. **Reinstall with adb**, which allow-lists restricted permissions: `adb install -r xText-debug.apk`.

If the prompt was simply dismissed twice, Android stops showing it; grant the permission under *App info > Permissions* instead. xText opens that page for you when it notices.

## Permissions and why

| Permission | Used for |
|---|---|
| Receive SMS, Send SMS | Reading incoming texts and sending voice replies |
| Microphone | Listening to your commands and dictation |
| Contacts (optional) | Saying "Mum" instead of a phone number |
| Notification access (optional) | Reading WhatsApp, Telegram, Signal, RCS and other apps, and replying through them |
| Notifications | The always-on status notification Android requires for background microphone use |
| Phone (optional) | The "call back" command |
| Ignore battery optimisation (optional) | Keeping the engine alive on aggressive OEM builds |

## How it works

```
SmsReceiver ─────────────┐
                         ├─► XTextService (foreground) ─► ConversationRunner ─► Speaker (TTS)
MessageNotificationListener ┘        │                           │              Listener (STT)
                                     │                           └─► MessageSender ─► SmsManager /
                                     └─► ReadPolicy (pause, quiet hours, headset, call, blocked)      notification RemoteInput
```

- `XTextService` is a foreground service declared with the `microphone` and `specialUse` types. Android only allows microphone access from the background when the service was started by the user (from the app or from a tap on its notification), so after a reboot the service comes back in a read-only standby mode until you tap **Enable voice replies**.
- `ConversationRunner` is a small callback-driven state machine: announce, command, dictation, confirmation, send.
- `VoiceCommands` and `TextCleaner` are pure Kotlin and unit-tested. Message text is cleaned for speech: links become "a link", emoji are stripped, common shorthand such as "omw" or "brb" is expanded.
- Messages received both as an SMS broadcast and as the SMS app's notification are read once.
- Speech recognition uses the device's on-device recogniser when available, falling back to the default service.

## Limitations

- Voice phrases are English. The phrase tables live in one file (`VoiceCommands.kt`) for easy localisation.
- Replying through another app depends on that app offering a reply action on its notification. All mainstream messengers do.
- Google Play's SMS policy restricts apps that use SMS permissions. xText is intended to be built and installed by you.

## Licence

MIT
