# OpenCast Server — Complete Setup Guide

## What This Server Does
- Generates **Agora RTC tokens** securely (your App Certificate never leaves the server)
- Manages **stream lifecycle** (create, end, viewer count) via Firestore
- Rate limits requests to prevent abuse

---

## STEP 1 — Create Agora Account

1. Go to **https://console.agora.io** and sign up (free)
2. Click **"New Project"**
   - Name: `OpenCast`
   - Authentication: **APP ID + Token** ← important, select this
3. Click **Submit**
4. You'll see your project. Click the **eye icon** to reveal:
   - **App ID** — copy this (goes in Flutter app + server .env)
   - **App Certificate** — copy this (goes in server .env ONLY, never in Flutter)

---

## STEP 2 — Set Up Firebase

1. Go to **https://console.firebase.google.com**
2. Create a project (or use existing one your Flutter app uses)
3. Go to **Project Settings → Service Accounts**
4. Click **"Generate new private key"** → download the JSON file
5. From that JSON file, you need:
   - `project_id` → FIREBASE_PROJECT_ID
   - `private_key` → FIREBASE_PRIVATE_KEY
   - `client_email` → FIREBASE_CLIENT_EMAIL

---

## STEP 3 — Deploy Server to Railway

### Option A: Deploy via GitHub (Recommended)

1. Create a GitHub account if you don't have one
2. Create a new repository called `open-cast-server`
3. Upload all files from this folder to it
4. Go to **https://railway.app** → sign up with GitHub
5. Click **"New Project" → "Deploy from GitHub repo"**
6. Select your `open-cast-server` repo
7. Railway will auto-detect Node.js and deploy it

### Set Environment Variables in Railway:
After deployment, go to your project → **Variables** tab and add:

```
AGORA_APP_ID          = paste your Agora App ID
AGORA_APP_CERTIFICATE = paste your Agora App Certificate
AGORA_TOKEN_EXPIRY    = 3600
FIREBASE_PROJECT_ID   = your Firebase project id
FIREBASE_PRIVATE_KEY  = your Firebase private key (with \n for newlines)
FIREBASE_CLIENT_EMAIL = your Firebase client email
```

### Option B: Run Locally First (for testing)

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env and fill in your Agora and Firebase credentials

# Run the server
npm start

# Test it (in another terminal)
curl http://localhost:3000/health
curl "http://localhost:3000/api/token/rtc?channel=test&uid=1234&role=publisher"
```

---

## STEP 4 — Update Flutter App

After Railway deploys, you get a URL like:
`https://open-cast-server-production.up.railway.app`

Open `lib/services/agora_service.dart` and update:

```dart
static const String serverUrl = 'https://open-cast-server-production.up.railway.app';
static const String appId = 'YOUR_AGORA_APP_ID';  // from Agora console
```

Also copy `agora_service_flutter.dart` from this folder to:
`lib/services/agora_service.dart` in your Flutter project

---

## STEP 5 — Add http package to Flutter

In your Flutter `pubspec.yaml`, add:
```yaml
dependencies:
  http: ^1.2.1
```

Then run:
```bash
flutter pub get
```

---

## STEP 6 — Build APK

```bash
flutter clean
flutter pub get
flutter build apk --release
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server health check |
| GET | `/api/token/rtc?channel=X&uid=Y&role=publisher` | Get publisher token |
| GET | `/api/token/rtc?channel=X&uid=Y&role=subscriber` | Get viewer token |
| POST | `/api/token/generate` | Get token (JSON body) |
| GET | `/api/streams` | List live streams |
| POST | `/api/streams/create` | Start a stream |
| POST | `/api/streams/end` | End a stream |
| POST | `/api/streams/viewer` | Update viewer count |

### Test token endpoint:
```
https://your-server.up.railway.app/api/token/rtc?channel=testchannel&uid=12345&role=publisher
```
Should return:
```json
{
  "token": "007eJxTYM...",
  "channel": "testchannel",
  "uid": 12345,
  "role": "publisher",
  "expiresIn": 3600,
  "appId": "your_app_id"
}
```

---

## Troubleshooting

**"Agora App ID and Certificate must be set"**
→ Environment variables not set in Railway. Go to Variables tab and add them.

**"Could not get streaming token"**
→ Server URL wrong in agora_service.dart, or server is down. Check /health endpoint.

**Build fails with Agora dependency error**
→ Add Agora Maven repo to `android/settings.gradle`:
```gradle
maven { url "https://www.jfrog.io/artifactory/open-source-maven-dev-local" }
```

**Token works but video doesn't appear**
→ Check camera/microphone permissions granted on device.
→ Make sure App ID in Flutter matches the one on Agora console.
