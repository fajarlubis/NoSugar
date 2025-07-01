// Configuration variables
let settings = {
  translationMode: "auto", // 'auto', 'manual', or 'off'
  targetLanguage: "en", // 'en', 'zh', or 'id'
  apiKey: "", // Google API key
};

// Language codes for detection and translation
const LANGUAGE_CODES = {
  en: "English",
  zh: "Chinese",
  id: "Indonesian",
};

// Cache for already translated messages to avoid redundant API calls
const translationCache = {};

// API endpoint for Google Cloud Translation API
const API_URL = "https://translation.googleapis.com/language/translate/v2";

// Load settings from storage when content script loads
chrome.storage.sync.get(
  {
    translationMode: "auto",
    targetLanguage: "en",
    apiKey: "",
  },
  function (data) {
    settings = data;
    if (settings.translationMode !== "off") {
      if (!settings.apiKey) {
        // Show a notification that API key is required
        showAPIKeyNotification();
      } else {
        initializeTranslator();
      }
    }
  }
);

// Listen for messages from popup
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "updateSettings") {
    settings = request.settings;

    // If translation is turned on, initialize the translator
    if (settings.translationMode !== "off") {
      if (!settings.apiKey) {
        // Show a notification that API key is required
        showAPIKeyNotification();
        // Remove existing translations if any
        document
          .querySelectorAll(".translation-container")
          .forEach((el) => el.remove());
      } else {
        initializeTranslator();
      }
    } else {
      // If translation is turned off, remove all translations
      document
        .querySelectorAll(".translation-container")
        .forEach((el) => el.remove());
    }
  }
});

// Show notification that Google API key is required
function showAPIKeyNotification() {
  // Check if notification already exists
  if (document.getElementById("api-key-notification")) return;

  // Create notification element
  const notification = document.createElement("div");
  notification.id = "api-key-notification";
  notification.style.position = "fixed";
  notification.style.top = "10px";
  notification.style.right = "10px";
  notification.style.backgroundColor = "#f44336";
  notification.style.color = "white";
  notification.style.padding = "15px";
  notification.style.borderRadius = "5px";
  notification.style.boxShadow = "0 2px 10px rgba(0,0,0,0.2)";
  notification.style.zIndex = "9999";
  notification.style.maxWidth = "300px";

  notification.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 5px;">Google API Key Required</div>
    <div style="margin-bottom: 10px;">Please set your Google Cloud Translation API key in the extension settings.</div>
    <div style="font-size: 12px;">Click the extension icon to add your API key.</div>
    <button id="dismiss-notification" style="margin-top: 10px; padding: 5px 10px; background: white; color: #f44336; border: none; border-radius: 3px; cursor: pointer;">Dismiss</button>
  `;

  document.body.appendChild(notification);

  // Add dismiss handler
  document
    .getElementById("dismiss-notification")
    .addEventListener("click", function () {
      notification.remove();
    });

  // Auto-dismiss after 10 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 10000);
}

// Initialize the translation features
function initializeTranslator() {
  // Wait for the chat interface to fully load
  setTimeout(() => {
    // Set up the message listener for the first time
    processVisibleMessages();

    // Set up the observer for new messages and scroll events
    setupObserver();
  }, 1000);
}

// Process all currently visible messages
function processVisibleMessages() {
  const messageBodies = document.querySelectorAll(".message-body");

  messageBodies.forEach((messageBody) => {
    processMessageBody(messageBody);
  });

  // Also add our outgoing message translation feature if not already added
  setupOutgoingTranslation();
}

// Process a single message body element
function processMessageBody(messageBody) {
  // Skip if this message body already has our translation container
  if (messageBody.querySelector(".translation-container")) return;

  // Get the message text
  const messageText = getMessageText(messageBody);
  if (!messageText || messageText.trim() === "") return;

  // Create translation container
  const translationContainer = document.createElement("div");
  translationContainer.className = "translation-container";
  translationContainer.style.marginTop = "8px";
  translationContainer.style.padding = "6px 8px";
  translationContainer.style.backgroundColor = "#f5f7f9";
  translationContainer.style.borderRadius = "4px";
  translationContainer.style.fontSize = "13px";
  translationContainer.style.borderLeft = "3px solid #4285f4";

  // Add initial loading indicator
  const loadingEl = document.createElement("div");
  loadingEl.textContent = "Detecting language...";
  loadingEl.style.color = "#666";
  loadingEl.style.fontStyle = "italic";
  translationContainer.appendChild(loadingEl);

  // Append translation container to message body
  messageBody.appendChild(translationContainer);

  // Translate based on mode
  if (settings.translationMode === "auto") {
    // Automatically translate the message
    translateMessage(messageText, translationContainer);
  } else if (settings.translationMode === "manual") {
    // Setup for manual translation
    loadingEl.textContent = "Click to translate";
    loadingEl.style.cursor = "pointer";
    loadingEl.addEventListener("click", () => {
      loadingEl.textContent = "Translating...";
      translateMessage(messageText, translationContainer);
    });
  }
}

// Add translation buttons and preview for outgoing messages
function setupOutgoingTranslation() {
  // Exit if buttons are already added or if input bar doesn't exist
  if (document.getElementById("translation-buttons-container")) return;

  const inputBar = document.querySelector(".conversation-input-bar__input");
  const controlsRight = document.querySelector(".controls-right");

  if (!inputBar || !controlsRight) return;

  // Create container for translation buttons
  const buttonsContainer = document.createElement("div");
  buttonsContainer.id = "translation-buttons-container";
  buttonsContainer.className = "buttons-group";
  buttonsContainer.style.display = "flex";
  buttonsContainer.style.marginRight = "5px";

  // Create translation buttons (EN, ID, ZH)
  const languages = [
    { code: "en", label: "EN" },
    { code: "id", label: "ID" },
    { code: "zh", label: "ZH" },
  ];

  // Get last active language from storage
  chrome.storage.sync.get({ activeTranslationLang: null }, function (data) {
    const activeLanguage = data.activeTranslationLang;

    languages.forEach((lang, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "controls-right-button";
      button.id = `lang-button-${lang.code}`;

      // Add appropriate classnames for styling consistency
      if (index === 0) {
        button.classList.add("buttons-group-button-left");
      } else if (index === languages.length - 1) {
        button.classList.add("buttons-group-button-right");
      } else {
        button.classList.add("no-radius");
      }

      // Set active state if this is the stored active language
      if (activeLanguage === lang.code) {
        button.classList.add("active");
        inputBar.dataset.activeTranslationLang = lang.code;
      }

      button.title = `Translate to ${LANGUAGE_CODES[lang.code]} (Alt+${
        index + 1
      })`;
      button.setAttribute("data-lang", lang.code);
      button.textContent = lang.label;

      // Style to match other buttons
      button.style.fontSize = "12px";
      button.style.fontWeight = "bold";

      // Add click event
      button.addEventListener("click", function () {
        // Deactivate all buttons
        document
          .querySelectorAll("#translation-buttons-container button")
          .forEach((btn) => {
            btn.classList.remove("active");
          });

        // If clicking the same button that's already active, deactivate it
        if (inputBar.dataset.activeTranslationLang === lang.code) {
          delete inputBar.dataset.activeTranslationLang;
          chrome.storage.sync.set({ activeTranslationLang: null });

          // Hide translation preview
          const previewContainer = document.getElementById(
            "translation-preview"
          );
          if (previewContainer) {
            previewContainer.style.display = "none";
          }
          return;
        }

        // Activate this button
        button.classList.add("active");

        // Store active language in inputBar dataset and storage
        inputBar.dataset.activeTranslationLang = lang.code;
        chrome.storage.sync.set({ activeTranslationLang: lang.code });

        // If there's text already in the input, translate it
        const inputElement = document.querySelector(
          '[data-uie-name="input-message"]'
        );
        const inputText = inputElement?.textContent.trim();
        if (inputText) {
          translateOutgoingMessage(lang.code);
        }
      });

      buttonsContainer.appendChild(button);
    });
  });

  // Insert buttons before the existing controls
  controlsRight.insertBefore(buttonsContainer, controlsRight.firstChild);

  // Create translation preview element
  const previewContainer = document.createElement("div");
  previewContainer.id = "translation-preview";
  previewContainer.style.display = "none";
  previewContainer.style.padding = "8px 10px";
  previewContainer.style.backgroundColor = "#f0f7ff";
  previewContainer.style.borderBottom = "1px solid #e1e8ed";
  previewContainer.style.fontSize = "13px";
  previewContainer.style.color = "#444";
  previewContainer.style.position = "relative";

  // Add shortcut hint at top of preview
  const shortcutHint = document.createElement("div");
  shortcutHint.style.fontSize = "11px";
  shortcutHint.style.color = "#666";
  shortcutHint.style.marginBottom = "5px";
  shortcutHint.style.display = "flex";
  shortcutHint.style.justifyContent = "space-between";
  shortcutHint.innerHTML = `
    <span>Press <kbd style="background:#f1f1f1;border:1px solid #ddd;border-radius:3px;padding:0 3px;font-family:monospace;">Alt+Enter</kbd> to send original</span>
    <span>Press <kbd style="background:#f1f1f1;border:1px solid #ddd;border-radius:3px;padding:0 3px;font-family:monospace;">Enter</kbd> to send translated</span>
  `;
  previewContainer.appendChild(shortcutHint);

  // Add close button to preview
  const closeButton = document.createElement("button");
  closeButton.innerHTML = "&times;";
  closeButton.style.position = "absolute";
  closeButton.style.right = "5px";
  closeButton.style.top = "5px";
  closeButton.style.background = "none";
  closeButton.style.border = "none";
  closeButton.style.fontSize = "16px";
  closeButton.style.cursor = "pointer";
  closeButton.style.color = "#777";
  closeButton.addEventListener("click", function () {
    previewContainer.style.display = "none";
    // Reset any stored translation
    delete inputBar.dataset.translatedText;
    delete inputBar.dataset.sourceText;
    delete inputBar.dataset.targetLang;
  });

  previewContainer.appendChild(closeButton);

  // Add preview label and content
  const previewLabel = document.createElement("div");
  previewLabel.style.fontSize = "11px";
  previewLabel.style.marginBottom = "3px";
  previewLabel.style.color = "#777";
  previewLabel.textContent = "Translation Preview:";

  const previewContent = document.createElement("div");
  previewContent.style.color = "#333";
  previewContent.style.padding = "6px 8px";
  previewContent.style.backgroundColor = "white";
  previewContent.style.borderRadius = "4px";
  previewContent.style.border = "1px solid #e1e8ed";

  previewContainer.appendChild(previewLabel);
  previewContainer.appendChild(previewContent);

  // Insert preview above the input
  inputBar.parentNode.insertBefore(previewContainer, inputBar);

  // Find the input element
  const inputElement = document.querySelector(
    '[data-uie-name="input-message"]'
  );
  if (inputElement) {
    // Capture keydown event at the capture phase (before the default handlers)
    inputElement.addEventListener(
      "keydown",
      function (e) {
        // Only process if we have an active translation language
        if (inputBar.dataset.activeTranslationLang) {
          // Alt+Enter to send original text
          if (e.key === "Enter" && e.altKey) {
            e.stopPropagation(); // Stop propagation but don't prevent default

            // Ensure we're sending the original text
            const originalText = inputElement.textContent.trim();

            // Hide preview
            previewContainer.style.display = "none";

            // Clear translation data since we're sending original
            delete inputBar.dataset.translatedText;
            delete inputBar.dataset.sourceText;

            // Let the default Enter behavior continue with original text
            return;
          }

          // Regular Enter to send translated text
          if (
            e.key === "Enter" &&
            !e.altKey &&
            inputBar.dataset.translatedText
          ) {
            // We need to intercept the Enter key and replace text with translation
            e.stopPropagation();
            e.preventDefault();

            // Replace input with translated text
            inputElement.textContent = inputBar.dataset.translatedText;

            // Hide preview
            previewContainer.style.display = "none";

            // Clear translation data
            const translatedText = inputBar.dataset.translatedText;
            delete inputBar.dataset.translatedText;
            delete inputBar.dataset.sourceText;

            // Trigger the Enter key event programmatically after replacing the text
            setTimeout(() => {
              // Create and dispatch a new Enter key event
              const enterEvent = new KeyboardEvent("keydown", {
                key: "Enter",
                code: "Enter",
                keyCode: 13,
                which: 13,
                bubbles: true,
                cancelable: true,
              });
              inputElement.dispatchEvent(enterEvent);
            }, 10);
          }
        }
      },
      true
    ); // Use capture phase to intercept before default handlers

    // Monitor input for changes to translate as you type
    const inputObserver = new MutationObserver(
      debounce(function (mutations) {
        const hasTextChange = mutations.some(
          (mutation) =>
            mutation.type === "characterData" || mutation.type === "childList"
        );

        if (hasTextChange && inputBar.dataset.activeTranslationLang) {
          const text = inputElement.textContent.trim();

          // Only translate if there's text and we're not in the middle of a translation
          if (text && !inputBar.dataset.translating) {
            // Mark that we're in the process of translating
            inputBar.dataset.translating = "true";

            // Translate using the active language
            translateOutgoingMessage(
              inputBar.dataset.activeTranslationLang
            ).finally(() => {
              delete inputBar.dataset.translating;
            });
          } else if (!text) {
            // Hide preview if no text
            previewContainer.style.display = "none";
          }
        }
      }, 500)
    );

    // Watch for changes to the input element
    inputObserver.observe(inputElement, {
      characterData: true,
      childList: true,
      subtree: true,
    });
  }

  // Add keyboard shortcuts for language buttons (Alt+1, Alt+2, Alt+3)
  document.addEventListener("keydown", function (e) {
    // Alt+1 for English, Alt+2 for Indonesian, Alt+3 for Chinese
    if (e.altKey && (e.key === "1" || e.key === "2" || e.key === "3")) {
      e.preventDefault();

      // Find the corresponding button
      const index = parseInt(e.key) - 1;
      const button = document.querySelector(
        `#lang-button-${languages[index].code}`
      );

      if (button) {
        button.click();
      }
    }
  });
}

// Translate the outgoing message
async function translateOutgoingMessage(targetLang) {
  // Return a promise to allow for chaining and async/await usage
  return new Promise(async (resolve, reject) => {
    try {
      // Get the input element
      const inputElement = document.querySelector(
        '[data-uie-name="input-message"]'
      );
      const inputBar = document.querySelector(".conversation-input-bar__input");
      const previewContainer = document.getElementById("translation-preview");
      const previewContent = previewContainer.querySelector("div:last-child");
      const previewLabel = previewContainer.querySelector("div:nth-child(3)"); // Account for shortcut hint

      if (
        !inputElement ||
        !inputBar ||
        !previewContainer ||
        !previewContent ||
        !previewLabel
      ) {
        reject(new Error("Required elements not found"));
        return;
      }

      // Get input text
      const inputText = inputElement.textContent.trim();
      if (!inputText) {
        previewContainer.style.display = "none";
        resolve();
        return;
      }

      // Check for API key
      if (!settings.apiKey) {
        alert(
          "Google API key required. Please add your API key in the extension settings."
        );
        reject(new Error("API key missing"));
        return;
      }

      // Set preview to loading state
      previewContent.textContent = "Translating...";
      previewContainer.style.display = "block";

      // Detect language
      const detectedLanguage = await detectLanguage(inputText);

      // If detected language is the same as target, show a message
      if (detectedLanguage === targetLang) {
        previewLabel.textContent = `Already in ${LANGUAGE_CODES[targetLang]}:`;
        previewContent.textContent = inputText;

        // Store original text as both source and translated
        inputBar.dataset.sourceText = inputText;
        inputBar.dataset.translatedText = inputText;
        inputBar.dataset.targetLang = targetLang;

        resolve();
        return;
      }

      // Translate the text
      const translatedText = await callTranslationAPI(
        inputText,
        detectedLanguage,
        targetLang
      );

      // Update preview
      previewLabel.textContent = `${LANGUAGE_CODES[detectedLanguage]} → ${LANGUAGE_CODES[targetLang]}:`;
      previewContent.textContent = translatedText;

      // Store translated text
      inputBar.dataset.sourceText = inputText;
      inputBar.dataset.translatedText = translatedText;
      inputBar.dataset.targetLang = targetLang;

      // Ensure send button is enabled
      const sendButton = document.querySelector(".controls-right-button--send");
      if (sendButton) {
        sendButton.disabled = false;
      }

      resolve();
    } catch (error) {
      console.error("Translation error:", error);

      // Update the UI with the error
      const previewContainer = document.getElementById("translation-preview");
      if (previewContainer) {
        const previewLabel = previewContainer.querySelector("div:nth-child(3)");
        const previewContent = previewContainer.querySelector("div:last-child");

        if (previewLabel && previewContent) {
          previewLabel.textContent = "Translation Error:";
          previewContent.textContent = error.message;
          previewContainer.style.display = "block";
        }
      }

      reject(error);
    }
  });
}

// Extract clean text from a message body
function getMessageText(messageBody) {
  // Check for text nodes within paragraph elements
  const paragraphs = messageBody.querySelectorAll("p");
  if (paragraphs.length > 0) {
    return Array.from(paragraphs)
      .map((p) => p.textContent)
      .join("\n")
      .trim();
  }

  // Fallback to direct text content if no paragraphs
  return messageBody.textContent.trim();
}

// Detect language of a text
async function detectLanguage(text) {
  // Simple language detection based on character analysis
  // This is a basic approach - for production, consider using a proper language detection library

  // Check for Chinese characters
  const hasChineseChars = /[\u4E00-\u9FFF]/.test(text);
  if (hasChineseChars) return "zh";

  // Check for common Indonesian words (basic approach)
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

  // If more than 10% of words match common Indonesian words, assume Indonesian
  if (indonesianWordCount > 0 && indonesianWordCount / words.length > 0.1) {
    return "id";
  }

  // Default to English for all other cases
  return "en";
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
  // Google can auto-detect if we don't specify
  if (sourceLang !== targetLang) {
    payload.source = sourceLang;
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json; charset=utf-8", // Explicitly request UTF-8 encoding
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

// Helper function to decode HTML entities
function decodeHTMLEntities(text) {
  // Create a temporary element to decode HTML entities
  const textArea = document.createElement("textarea");
  textArea.innerHTML = text;
  const decodedText = textArea.value;
  return decodedText;
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

  // Use textContent rather than innerHTML for security
  // But ensure we're handling Unicode properly
  translationText.textContent = translationData.translated;

  // Add elements to container
  containerElement.appendChild(langIndicator);
  containerElement.appendChild(translationText);
}

// Create a more specific observer for the message list to catch dynamically loaded messages
function setupObserver() {
  // First, check if we already have an observer running
  if (window._translationObserver) {
    window._translationObserver.disconnect();
  }

  // Create a new observer for the message list
  window._translationObserver = new MutationObserver(function (mutations) {
    // Check if any mutations involved adding nodes
    const hasAddedNodes = mutations.some(
      (mutation) =>
        mutation.type === "childList" && mutation.addedNodes.length > 0
    );

    if (hasAddedNodes) {
      // Give a slight delay to ensure DOM is fully updated
      setTimeout(processVisibleMessages, 100);
    }
  });

  // Create a new observer for the entire content to detect conversation switching
  if (!window._conversationObserver) {
    window._conversationObserver = new MutationObserver(function (mutations) {
      // Look for changes in the URL or conversation container changes
      const hasConversationChanged = mutations.some((mutation) => {
        // Check for changes to the conversation container
        if (
          mutation.target &&
          (mutation.target.id === "conversation" ||
            (mutation.target.classList &&
              mutation.target.classList.contains("conversation")))
        ) {
          return true;
        }

        // Check for URL changes or active conversation indicators
        return (
          mutation.target &&
          mutation.target.classList &&
          (mutation.target.classList.contains(
            "conversation-list-cell--active"
          ) ||
            mutation.target.classList.contains("center-column__overlay"))
        );
      });

      if (hasConversationChanged) {
        console.log("Conversation changed - reprocessing messages");
        // Clear translation cache when switching conversations
        Object.keys(translationCache).forEach((key) => {
          delete translationCache[key];
        });
        // Process visible messages with a delay
        setTimeout(processVisibleMessages, 300);
      }
    });

    // Start observing the document for conversation changes
    window._conversationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "id"],
    });
  }

  // Find the message list container
  const messageList =
    document.getElementById("message-list") ||
    document.querySelector(".message-list");

  if (messageList) {
    // Start observing the message list for changes
    window._translationObserver.observe(messageList, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false,
    });

    // Also process current messages
    processVisibleMessages();

    // Add scroll listener to process messages when scrolling
    messageList.addEventListener(
      "scroll",
      debounce(processVisibleMessages, 500)
    );
  } else {
    // If message list isn't found yet, try again soon
    setTimeout(setupObserver, 500);
  }

  // Also set up an observer for the input area in case it gets dynamically loaded
  setupInputObserver();

  // Check for conversation list to add click handler
  setupConversationListObserver();
}

// Set up observer for conversation list to detect switching between conversations
function setupConversationListObserver() {
  const conversationList =
    document.querySelector(".conversation-list-cell") ||
    document.querySelector('[data-uie-name="conversation-view"]');

  if (conversationList) {
    // Add click handlers to each conversation item
    document
      .querySelectorAll('[data-uie-name="item-conversation"]')
      .forEach((item) => {
        // Skip if already has our handler
        if (item.dataset.translationHandlerAdded) return;

        item.dataset.translationHandlerAdded = "true";
        item.addEventListener("click", () => {
          console.log("Conversation clicked - will process after switch");
          // Clear cache and reprocess after conversation switch
          setTimeout(() => {
            Object.keys(translationCache).forEach((key) => {
              delete translationCache[key];
            });
            processVisibleMessages();
          }, 500);
        });
      });

    // Also setup a periodic check for new conversations
    if (!window._conversationCheckInterval) {
      window._conversationCheckInterval = setInterval(() => {
        document
          .querySelectorAll('[data-uie-name="item-conversation"]')
          .forEach((item) => {
            if (!item.dataset.translationHandlerAdded) {
              setupConversationListObserver();
            }
          });
      }, 5000);
    }
  } else {
    // If not found, try again later
    setTimeout(setupConversationListObserver, 1000);
  }
}

// Set up an observer for the input area to ensure our translation buttons are added
function setupInputObserver() {
  // Create a new observer
  const inputObserver = new MutationObserver(function (mutations) {
    // Check if our translation buttons are missing
    if (!document.getElementById("translation-buttons-container")) {
      setupOutgoingTranslation();
    }
  });

  // Observe the conversation container for changes
  const conversationArea =
    document.getElementById("conversation") ||
    document.querySelector(".conversation");
  if (conversationArea) {
    inputObserver.observe(conversationArea, {
      childList: true,
      subtree: true,
      attributes: false,
    });
  }
}

// Utility function: Debounce to avoid excessive processing during rapid scrolling
function debounce(func, wait) {
  let timeout;
  return function () {
    const context = this;
    const args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}
