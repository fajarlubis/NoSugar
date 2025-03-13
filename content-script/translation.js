// content-script/translation.js
var Translation = (function () {
  // Language codes for detection and translation
  const LANGUAGE_CODES = {
    en: "English",
    zh: "Chinese",
    id: "Indonesian",
  };

  // API endpoint for Google Cloud Translation API
  const API_URL = "https://translation.googleapis.com/language/translate/v2";

  // Translation cache
  const translationCache = {};

  // Settings
  let settings = {
    translationMode: "auto",
    targetLanguage: "en",
    apiKey: "",
  };

  // Initialize settings
  async function initSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(
        {
          translationMode: "auto",
          targetLanguage: "en",
          apiKey: "",
        },
        (data) => {
          settings = data;
          resolve(settings);
        }
      );
    });
  }

  // Get settings
  function getSettings() {
    return settings;
  }

  // Detect language of a text
  async function detectLanguage(text) {
    // Check for Chinese characters
    const hasChineseChars = /[\u4E00-\u9FFF]/.test(text);
    if (hasChineseChars) return "zh";

    // Check for common Indonesian words
    const commonIndonesianWords = [
      "yang",
      "dan",
      "dari",
      "dengan",
      "untuk",
      "tidak",
      "ini",
      "itu",
      "di",
      "ke",
      "pada",
    ];
    const words = text.toLowerCase().split(/\s+/);
    const indonesianWordCount = words.filter((word) =>
      commonIndonesianWords.includes(word)
    ).length;

    if (indonesianWordCount > 0 && indonesianWordCount / words.length > 0.1) {
      return "id";
    }

    // Default to English
    return "en";
  }

  // Helper function to decode HTML entities
  function decodeHTMLEntities(text) {
    const textArea = document.createElement("textarea");
    textArea.innerHTML = text;
    return textArea.value;
  }

  // Call the Google Translation API
  async function callTranslationAPI(text, sourceLang, targetLang) {
    // Make sure we have an API key
    if (!settings.apiKey) {
      throw new Error("Google API key is required");
    }

    // For Google Translate API, we need to use 'zh-CN' for Chinese
    if (sourceLang === "zh") sourceLang = "zh-CN";
    if (targetLang === "zh") targetLang = "zh-CN";

    // Build the URL with query parameters and API key
    const url = `${API_URL}?key=${encodeURIComponent(settings.apiKey)}`;

    const payload = {
      q: text,
      target: targetLang,
      format: "text", // Explicitly request text format
    };

    // Only specify source if we're sure about it
    if (sourceLang !== targetLang) {
      payload.source = sourceLang;
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json; charset=utf-8",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Google API error:", errorText);
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      // Extract the translated text from Google's response format
      if (
        data.data &&
        data.data.translations &&
        data.data.translations.length > 0
      ) {
        // Decode HTML entities in the translated text
        const translatedText = data.data.translations[0].translatedText;
        return decodeHTMLEntities(translatedText);
      } else {
        throw new Error("Unexpected API response format");
      }
    } catch (error) {
      console.error("Translation API error:", error);
      throw error;
    }
  }

  // Translate a message
  async function translateMessage(text, containerElement) {
    try {
      // Skip translation if text is empty
      if (!text || text.trim() === "") {
        containerElement.textContent = "(No text to translate)";
        return;
      }

      // Skip translation if missing API key
      if (!settings.apiKey) {
        containerElement.innerHTML =
          '<span style="color:#d93025">Google API key required</span>';
        return;
      }

      // Generate a cache key based on text and target language
      const cacheKey = `${text}|${settings.targetLanguage}`;

      // Check if translation is already in cache
      if (translationCache[cacheKey]) {
        updateTranslationUI(containerElement, translationCache[cacheKey]);
        return;
      }

      // Update UI to show loading state
      containerElement.innerHTML =
        '<span style="color:#666;font-style:italic;">Translating...</span>';

      // Detect the source language
      const detectedLanguage = await detectLanguage(text);

      // If detected language is the same as target, show a message and exit
      if (detectedLanguage === settings.targetLanguage) {
        containerElement.textContent = `(Already in ${
          LANGUAGE_CODES[settings.targetLanguage]
        })`;
        return;
      }

      let translationResult;

      try {
        // Call the Google Translation API
        translationResult = await callTranslationAPI(
          text,
          detectedLanguage,
          settings.targetLanguage
        );

        // Store in cache
        translationCache[cacheKey] = {
          translated: translationResult,
          from: detectedLanguage,
          to: settings.targetLanguage,
        };

        // Update UI with translation
        updateTranslationUI(containerElement, translationCache[cacheKey]);
      } catch (apiError) {
        console.error("Translation error:", apiError);
        containerElement.innerHTML = `
          <span style="color:#d93025">Translation error: ${apiError.message}</span>
          <div style="font-size:11px;margin-top:3px;color:#666">
            Check your API key and settings.
          </div>
        `;
      }
    } catch (error) {
      console.error("General translation error:", error);
      containerElement.innerHTML = `<span style="color:#d93025">Error: ${error.message}</span>`;
    }
  }

  // Update the translation UI with results
  function updateTranslationUI(containerElement, translationData) {
    // Clear the container
    containerElement.innerHTML = "";

    // Create language indicator
    const langIndicator = document.createElement("div");
    langIndicator.style.fontSize = "11px";
    langIndicator.style.color = "#666";
    langIndicator.style.marginBottom = "3px";
    langIndicator.textContent = `${LANGUAGE_CODES[translationData.from]} → ${
      LANGUAGE_CODES[translationData.to]
    }`;

    // Create translation text element
    const translationText = document.createElement("div");
    translationText.style.color = "#222";

    // Use textContent for security
    translationText.textContent = translationData.translated;

    // Add elements to container
    containerElement.appendChild(langIndicator);
    containerElement.appendChild(translationText);
  }

  // Clear the translation cache
  function clearCache() {
    Object.keys(translationCache).forEach((key) => {
      delete translationCache[key];
    });
  }

  // Expose public methods and properties
  return {
    LANGUAGE_CODES: LANGUAGE_CODES,
    initSettings: initSettings,
    getSettings: getSettings,
    detectLanguage: detectLanguage,
    translateMessage: translateMessage,
    callTranslationAPI: callTranslationAPI,
    clearCache: clearCache,
  };
})();
