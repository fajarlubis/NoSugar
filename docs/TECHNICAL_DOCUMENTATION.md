# NoSugar Technical Documentation

## Overview

NoSugar is composed of a Google Chrome extension and a small Go server used to proxy translation requests. The extension enhances the Wire web chat client by translating messages directly inside the page, while the server forwards requests to either DeepL or Google Translate.

The extension is available on the Chrome Web Store: [NoSugar Translator](https://chromewebstore.google.com/detail/bfgpgdobiokaolfdmghmndenelkcjbpp?utm_source=item-share-cb).

Project directories:

- `chrome-extension/` – source for the extension.
- `server/` – Go API used by the extension.
- `deploy/` – sample Kubernetes manifest.

---

## Chrome Extension

### Manifest

The extension is built with Manifest V3. Key settings are visible in `manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "No Sugar Translator",
  "version": "2.0",
  "description": "Pure Translation. No Sugar Added.",
  "permissions": ["activeTab", "storage"],
  "host_permissions": ["*://*.chat/*", "https://nosugar.fajarlubis.me/*", "http://*/*", "https://*/*"],
  "action": {"default_popup": "popup.html"},
  "content_scripts": [ { "matches": ["*://*.chat/*"], "js": ["content-script/translation.js", "content-script/ui.js", "content-script/observers.js", "content-script/main.js"], "css": ["content.css"], "run_at": "document_idle" } ],
  "background": {"service_worker": "background.js"}
}
```

### Background Script

The background service worker manages settings and broadcasts updates to all open tabs. It listens for `saveSettings` and `checkForTranslatableTabs` actions and forwards configuration to content scripts.

```javascript
// background.js excerpt
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "saveSettings") {
    chrome.storage.sync.set(message.settings, () => {
      broadcastToContentScripts(message);
      sendResponse({ success: true, message: "Settings saved and broadcast" });
    });
    return true;
  }
});
```

### Content Scripts

The extension injects several content scripts into `*.chat` pages. Translation logic lives in `content-script/translation.js`. Messages are translated by calling the configured server with an authorization code and caching results.

```javascript
// translation.js excerpt
const DEFAULT_SERVER_URL = "https://nosugar.fajarlubis.me";
async function callTranslationAPI(text, sourceLang, targetLang) {
  if (!settings.authCode) throw new Error("Authorization code is required");
  const payload = { text: [text], target_lang: targetLang.toUpperCase(), source_lang: sourceLang.toUpperCase() };
  const response = await fetch(getServerURL(), {
    method: "POST",
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json; charset=utf-8",
      Authorization: settings.authCode,
      "X-NoSugar-App": "chrome-extension",
    },
  });
  const data = await response.json();
  return data.translations[0].text;
}
```

DOM observers in `observers.js` watch the chat for new messages and process them, while `ui.js` adds buttons to translate outgoing messages on demand.

## Translation Server

The server is written in Go and exposes a single HTTP endpoint for translation. Configuration is loaded from environment variables, defaulting to DeepL if no engine is specified.

```go
// config.Load
Engine:       strings.ToLower(os.Getenv("TRANSLATION_ENGINE")),
DeepLKey:     os.Getenv("DEEPL_AUTH_KEY"),
GoogleKey:    os.Getenv("GOOGLE_API_KEY"),
ClientAPIKey: os.Getenv("CLIENT_API_KEY"),
```

The API handler validates the `Authorization` header and forwards the request to the selected engine.

```go
func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
  if r.Method != http.MethodPost {
    http.Error(w, "Only POST allowed", http.StatusMethodNotAllowed)
    return
  }
  if h.apiKey != "" && r.Header.Get("Authorization") != h.apiKey {
    http.Error(w, "Unauthorized", http.StatusUnauthorized)
    return
  }
  // decode request and call service...
}
```

The server listens on port 8080 and also serves a simple WebSocket handler for status checks.

```go
return &http.Server{
  Addr: ":8080",
  Handler: mux,
}
```

### Engines

Two translation engines are implemented under `internal/infrastructure`:
- `deepl` – calls the [DeepL API](https://api-free.deepl.com/v2/translate).
- `google` – calls the Google Cloud Translation API.

### Environment File

An example `.env` file is provided:

```env
TRANSLATION_ENGINE=deepl
DEEPL_AUTH_KEY=your_deepl_key
GOOGLE_API_KEY=your_google_key
CLIENT_API_KEY=your_client_key
```

### Deployment

A Dockerfile is provided for building the API server container. The `deploy/deployment.yml` manifest shows an example Kubernetes deployment and service. Secrets are used to supply API keys.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nosugar-api
spec:
  replicas: 1
  template:
    spec:
      containers:
      - name: api
        image: ghcr.io/fajarlubis/nosugar:latest
        envFrom:
        - secretRef:
            name: nosugar-secret
```

### Running Locally

1. Copy `server/.env.example` to `.env` and fill in API keys.
2. Build the server:
   ```bash
   cd server
   go build ./cmd/nosugar
   ./nosugar
   ```
3. Load the extension from `chrome-extension/` in Chrome's extensions page (developer mode) or install it from the Chrome Web Store.
4. Open the popup and set the authorization code to match `CLIENT_API_KEY` on the server.

---

## Privacy

The extension stores preferences locally and only sends the selected message text to your configured server for translation. No messages are stored by the project.

