// content-script/translation.js
var Translation = (function () {
  // Language codes for detection and translation
  const LANGUAGE_CODES = {
    en: "English",
    zh: "Chinese",
    id: "Indonesian",
  };

  // Default translation server
  const DEFAULT_SERVER_URL = "https://nosugar.fajarlubis.me";

  // Translation cache
  const translationCache = {};
  const CACHE_LIFETIME = 28 * 24 * 60 * 60 * 1000; // 4 weeks

  // Load persistent cache from chrome.storage.local
  async function loadPersistentCache() {
    return new Promise((resolve) => {
      chrome.storage.local.get({ translationCache: {} }, (result) => {
        const now = Date.now();
        Object.entries(result.translationCache).forEach(([key, entry]) => {
          if (entry.timestamp && now - entry.timestamp < CACHE_LIFETIME) {
            translationCache[key] = entry;
          }
        });
        resolve();
      });
    });
  }

  // Save a single entry to chrome.storage.local
  function saveEntryToPersistentCache(key, entry) {
    chrome.storage.local.get({ translationCache: {} }, (result) => {
      const cache = result.translationCache;
      cache[key] = entry;
      chrome.storage.local.set({ translationCache: cache });
    });
  }

  // Settings
  let settings = {
    translationMode: "auto",
    targetLanguage: "en",
    authCode: "",
    useCustomServer: false,
    customServerAddress: "",
    translationPlacement: "bottom",
  };

  // Initialize settings
  async function initSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(
        {
          translationMode: "auto",
          targetLanguage: "en",
          authCode: "",
          useCustomServer: false,
          customServerAddress: "",
          translationPlacement: "bottom",
        },
        async (data) => {
          settings = data;
          await loadPersistentCache();
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

  // Build the server URL depending on user settings
  function getServerURL() {
    if (settings.useCustomServer && settings.customServerAddress) {
      const prefix = settings.customServerAddress.startsWith("http")
        ? settings.customServerAddress
        : `http://${settings.customServerAddress}`;
      return prefix;
    }
    return DEFAULT_SERVER_URL;
  }

  // Call the translation server
  async function callTranslationAPI(text, sourceLang, targetLang) {
    if (!settings.authCode) {
      throw new Error("Authorization code is required");
    }

    const url = getServerURL();

    const payload = {
      text: [text],
      target_lang: targetLang.toUpperCase(),
      source_lang: sourceLang.toUpperCase(),
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json; charset=utf-8",
          Authorization: settings.authCode,
          "X-NoSugar-App": "chrome-extension",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Server error:", errorText);
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.translations && Array.isArray(data.translations) && data.translations[0]) {
        return data.translations[0].text;
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

      // Skip translation if missing authorization code
      if (!settings.authCode) {
        containerElement.innerHTML =
          '<span style="color:#d93025">Authorization code required</span>';
        return;
      }

      // Generate a cache key based on text and target language
      const cacheKey = `${text}|${settings.targetLanguage}`;

      // Check if translation is already in cache
      if (translationCache[cacheKey]) {
        updateTranslationUI(containerElement, translationCache[cacheKey]);
        return;
      } else {
        const storedEntry = await new Promise((resolve) => {
          chrome.storage.local.get({ translationCache: {} }, (result) => {
            const entry = result.translationCache[cacheKey];
            if (
              entry &&
              entry.timestamp &&
              Date.now() - entry.timestamp < CACHE_LIFETIME
            ) {
              translationCache[cacheKey] = entry;
              resolve(entry);
            } else {
              resolve(null);
            }
          });
        });
        if (storedEntry) {
          updateTranslationUI(containerElement, storedEntry);
          return;
        }
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
        // Call the translation server
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
          timestamp: Date.now(),
        };
        saveEntryToPersistentCache(cacheKey, translationCache[cacheKey]);

        // Update UI with translation
        updateTranslationUI(containerElement, translationCache[cacheKey]);
      } catch (apiError) {
        console.error("Translation error:", apiError);
        containerElement.innerHTML = `
          <span style="color:#d93025">Translation error: ${apiError.message}</span>
          <div style="font-size:11px;margin-top:3px;color:#666">
            Check your authorization code and settings.
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
  async function clearCache() {
    Object.keys(translationCache).forEach((key) => {
      delete translationCache[key];
    });
    await loadPersistentCache();
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
