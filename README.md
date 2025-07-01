# NoSugar - Translation Add-on for Wire Chat App

**NoSugar** is an open-source Chrome extension designed to enhance the [Wire](https://github.com/wireapp) open-source chat app by providing seamless message translation. Whether you're chatting with international contacts or joining global conversations, NoSugar helps you understand and communicate better.

## 🚀 Features
- 🌍 **Instant Translation:** Translates messages in real-time within the Wire chat interface.
- 🔄 **Automatic Language Detection:** Detects the original language and translates it to your preferred language.
- 🛡️ **Privacy First:** No sensitive data is stored; all translations are processed securely.
- ⚙️ **Customizable Settings:** Set your preferred language and configure translation behavior.
- 📐 **Flexible Placement:** Choose whether translations appear below or to the right of each message.
- 🔗 **Seamless Integration:** Integrates directly with the Wire chat interface for a smooth experience.

## 🖥️ Installation
1. Download the latest release from the [Releases](https://github.com/fajarlubis/NoSugar/releases) page.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **"Load unpacked"** and select the extracted folder.

## 📋 Usage
1. Open the [Wire Web App](https://app.wire.com/) in your Chrome browser.
2. Start a conversation, and the extension will automatically detect and translate messages.
3. Use the extension icon in the Chrome toolbar to adjust settings.

## ⚙️ Configuration
- **Preferred Language:** Choose your target language for translation.
- **Auto-Translate:** Enable or disable automatic message translation.
- **Highlight Translations:** Toggle highlighted translations for better visibility.
- **Server Configuration:** Use the default translation server or specify your own address. Include the port in the URL if needed. An authorization code is required for all requests.
- **Translation Placement:** Display translations below each message or to the right of the original bubble.

### 🌐 Server API
By default the extension sends translation requests to `https://nosugar.fajarlubis.me` using a POST request. You can run your own server and provide its address in the settings (add the port in the URL if required). Every request includes an `Authorization` header along with an `X-NoSugar-App` header so the server can identify the client.

Example request body:

```json
{
  "text": ["插件的代码发我一下呗 👍"],
  "target_lang": "EN",
  "source_lang": "ZH"
}
```

Expected response:

```json
{
  "translations": [
    {
      "detected_source_language": "ZH",
      "text": "Send me the code for the plugin 👍"
    }
  ]
}
```

### Server Environment Variables

When running your own translation server, configure it using the following environment variables:

- `TRANSLATION_ENGINE` – provider to use (`deepl` or `google`, default `deepl`).
- `DEEPL_AUTH_KEY` – API key for DeepL translations.
- `GOOGLE_API_KEY` – API key for Google Cloud Translation.

You can place these in a `.env` file (see `server/.env.example`) and the server will load them automatically at startup.


## 🐛 Known Issues
- Occasional delays for lengthy messages.
- May require a page refresh if translations stop appearing.

## 🛠️ Contributing
Contributions are welcome! Follow these steps to get started:
1. Fork the repository.
2. Create a new branch: `git checkout -b feature-name`.
3. Commit your changes: `git commit -m "Add new feature"`.
4. Push to your branch: `git push origin feature-name`.
5. Create a pull request.

## 📄 License
This project is licensed under the [MIT License](LICENSE).

## 📧 Contact
For questions or suggestions, please open an [issue](https://github.com/fajarlubis/NoSugar/issues) or contact me directly.

---

Enjoy chatting without language barriers with **NoSugar**! 🍬🚫
