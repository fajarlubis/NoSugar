// content-script/main.js
(function () {
  // Show notification that authorization code is required
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
      <div style="font-weight: bold; margin-bottom: 5px;">Authorization Required</div>
      <div style="margin-bottom: 10px;">Please set the server authorization code in the extension settings.</div>
      <div style="font-size: 12px;">Click the extension icon to add your code.</div>
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

  // Initialize the translator
  function initializeTranslator() {
    // Wait for the chat interface to fully load
    setTimeout(() => {
      // Process visible messages
      const messageBodies = document.querySelectorAll(".message-body");
      messageBodies.forEach((messageBody) => {
        UI.processMessageBody(messageBody);
      });

      // Setup outgoing translation UI
      UI.setupOutgoingTranslation();

      // Setup observers
      Observers.setupObservers();
    }, 1000);
  }

  // Handle messages from background script
  function handleMessages(request, sender, sendResponse) {
    if (request.action === "updateSettings") {
      const settings = Translation.getSettings();
      Object.assign(settings, request.settings);

      // If translation is turned on, initialize the translator
      if (settings.translationMode !== "off") {
        if (!settings.authCode) {
          // Show a notification that auth code is required
          showAPIKeyNotification();
        }

        // Remove existing translations before re-processing
        document
          .querySelectorAll(".translation-container")
          .forEach((el) => {
            const wrapper = el.parentElement;
            el.remove();
            if (
              wrapper &&
              wrapper.classList.contains("translation-wrapper")
            ) {
              const msg = wrapper.querySelector(".message-body");
              if (msg) wrapper.parentNode.insertBefore(msg, wrapper);
              wrapper.remove();
            }
          });

        initializeTranslator();
      } else {
        // If translation is turned off, remove all translations
        document
          .querySelectorAll(".translation-container")
          .forEach((el) => {
            const wrapper = el.parentElement;
            el.remove();
            if (
              wrapper &&
              wrapper.classList.contains("translation-wrapper")
            ) {
              const msg = wrapper.querySelector(".message-body");
              if (msg) wrapper.parentNode.insertBefore(msg, wrapper);
              wrapper.remove();
            }
          });
      }

      sendResponse({ success: true });
      return true;
    }
  }

  // Initialize extension
  async function initialize() {
    try {
      // Load settings
      await Translation.initSettings();

      // Initialize UI and observers
      const settings = Translation.getSettings();

      if (settings.translationMode !== "off") {
        if (!settings.authCode) {
          showAPIKeyNotification();
        }
        initializeTranslator();
      }

      // Listen for messages from background script
      chrome.runtime.onMessage.addListener(handleMessages);
    } catch (error) {
      console.error("Error initializing extension:", error);
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
})();
