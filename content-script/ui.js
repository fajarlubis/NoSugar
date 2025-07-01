// content-script/ui.js
var UI = (function () {
  // Local debounce implementation to avoid dependency issues
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

  // Process a single message body element
  function processMessageBody(messageBody) {
    const settings = Translation.getSettings();

    // Skip if this message body already has a translation container
    if (
      messageBody.parentNode &&
      messageBody.parentNode.querySelector(':scope > .translation-container')
    ) {
      return;
    }

    // Get the message text
    const messageText = getMessageText(messageBody);
    if (!messageText || messageText.trim() === "") return;

    // Create translation container
    const translationContainer = document.createElement("div");
    translationContainer.className = "translation-container";
    // Default margin for bottom placement
    translationContainer.style.marginTop =
      settings.translationPlacement === "bottom" ? "8px" : "0";
    translationContainer.style.padding = "6px 8px";
    translationContainer.style.fontSize = "13px";

    // Try to mirror the message bubble's style
    const computed = window.getComputedStyle(messageBody);
    // Fallback to sane defaults if style values are empty or transparent
    const bgColor = computed.backgroundColor &&
      computed.backgroundColor !== "rgba(0, 0, 0, 0)"
        ? computed.backgroundColor
        : "#f5f7f9";
    const radius = computed.borderRadius && computed.borderRadius !== "0px"
        ? computed.borderRadius
        : "4px";
    translationContainer.style.backgroundColor = bgColor;
    translationContainer.style.borderRadius = radius;
    translationContainer.style.borderLeft = "3px solid #4285f4";

    // Add initial loading indicator
    const loadingEl = document.createElement("div");
    loadingEl.textContent = "Detecting language...";
    loadingEl.style.color = "#666";
    loadingEl.style.fontStyle = "italic";
    translationContainer.appendChild(loadingEl);

    // Position translation container based on user setting
    if (settings.translationPlacement === "right") {
      let wrapper;
      if (messageBody.parentNode &&
          messageBody.parentNode.classList.contains("translation-wrapper")) {
        wrapper = messageBody.parentNode;
      } else {
        wrapper = document.createElement("div");
        wrapper.className = "translation-wrapper";
        wrapper.style.display = "flex";
        wrapper.style.alignItems = "flex-start";
        wrapper.style.gap = "8px";
        if (messageBody.parentNode) {
          messageBody.parentNode.insertBefore(wrapper, messageBody);
          wrapper.appendChild(messageBody);
        }
      }
      wrapper.appendChild(translationContainer);
    } else {
      // Place translation container inside the message bubble
      const readIndicator = messageBody.querySelector('.read-indicator-wrapper');
      if (readIndicator) {
        messageBody.insertBefore(translationContainer, readIndicator);
      } else {
        messageBody.appendChild(translationContainer);
      }
    }

    // Translate based on mode
    if (settings.translationMode === "auto") {
      // Automatically translate the message
      Translation.translateMessage(messageText, translationContainer);
    } else if (settings.translationMode === "manual") {
      // Setup for manual translation
      loadingEl.textContent = "Click to translate";
      loadingEl.style.cursor = "pointer";
      loadingEl.addEventListener("click", () => {
        loadingEl.textContent = "Translating...";
        Translation.translateMessage(messageText, translationContainer);
      });
    }
  }

  // Setup outgoing translation UI
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

        button.title = `Translate to ${
          Translation.LANGUAGE_CODES[lang.code]
        } (Alt+${index + 1})`;
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
        const inputBar = document.querySelector(
          ".conversation-input-bar__input"
        );
        const previewContainer = document.getElementById("translation-preview");
        const previewContent = previewContainer.querySelector("div:last-child");
        const previewLabel = previewContainer.querySelector("div:nth-child(3)");

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

        // Check for authorization code
        const settings = Translation.getSettings();
        if (!settings.authCode) {
          alert(
            "Authorization code required. Please add it in the extension settings."
          );
          reject(new Error("Authorization missing"));
          return;
        }

        // Set preview to loading state
        previewContent.textContent = "Translating...";
        previewContainer.style.display = "block";

        // Detect language
        const detectedLanguage = await Translation.detectLanguage(inputText);

        // If detected language is the same as target, show a message
        if (detectedLanguage === targetLang) {
          previewLabel.textContent = `Already in ${Translation.LANGUAGE_CODES[targetLang]}:`;
          previewContent.textContent = inputText;

          // Store original text as both source and translated
          inputBar.dataset.sourceText = inputText;
          inputBar.dataset.translatedText = inputText;
          inputBar.dataset.targetLang = targetLang;

          resolve();
          return;
        }

        // Translate the text
        const translatedText = await Translation.callTranslationAPI(
          inputText,
          detectedLanguage,
          targetLang
        );

        // Update preview
        previewLabel.textContent = `${Translation.LANGUAGE_CODES[detectedLanguage]} → ${Translation.LANGUAGE_CODES[targetLang]}:`;
        previewContent.textContent = translatedText;

        // Store translated text
        inputBar.dataset.sourceText = inputText;
        inputBar.dataset.translatedText = translatedText;
        inputBar.dataset.targetLang = targetLang;

        // Ensure send button is enabled
        const sendButton = document.querySelector(
          ".controls-right-button--send"
        );
        if (sendButton) {
          sendButton.disabled = false;
        }

        resolve();
      } catch (error) {
        console.error("Translation error:", error);

        // Update the UI with the error
        const previewContainer = document.getElementById("translation-preview");
        if (previewContainer) {
          const previewLabel =
            previewContainer.querySelector("div:nth-child(3)");
          const previewContent =
            previewContainer.querySelector("div:last-child");

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

  // Expose public methods
  return {
    getMessageText: getMessageText,
    processMessageBody: processMessageBody,
    setupOutgoingTranslation: setupOutgoingTranslation,
    translateOutgoingMessage: translateOutgoingMessage,
  };
})();
