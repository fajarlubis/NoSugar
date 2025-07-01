// content-script/observers.js
var Observers = (function () {
  // Set up observers for the chat application
  function setupObservers() {
    setupMessageListObserver();
    setupConversationListObserver();
    setupInputObserver();
  }

  // Setup message list observer
  function setupMessageListObserver() {
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
        // Give a delay to ensure DOM is fully updated
        setTimeout(() => {
          const messageBodies = document.querySelectorAll(".message-body");
          messageBodies.forEach((messageBody) => {
            UI.processMessageBody(messageBody);
          });
        }, 100);
      }
    });

    // Create a new observer for conversation switching
    if (!window._conversationObserver) {
      window._conversationObserver = new MutationObserver(function (mutations) {
        // Look for changes in conversation container
        const hasConversationChanged = mutations.some((mutation) => {
          if (
            mutation.target &&
            (mutation.target.id === "conversation" ||
              (mutation.target.classList &&
                mutation.target.classList.contains("conversation")))
          ) {
            return true;
          }

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
          Translation.clearCache();

          // Process visible messages with a delay
          setTimeout(() => {
            const messageBodies = document.querySelectorAll(".message-body");
            messageBodies.forEach((messageBody) => {
              UI.processMessageBody(messageBody);
            });
          }, 300);
        }
      });

      // Start observing document for conversation changes
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

      // Add scroll listener to process messages when scrolling
      // Using local debounce implementation instead of referencing Utils.debounce
      messageList.addEventListener(
        "scroll",
        debounceScroll(() => {
          const messageBodies = document.querySelectorAll(".message-body");
          messageBodies.forEach((messageBody) => {
            UI.processMessageBody(messageBody);
          });
        }, 500)
      );
    } else {
      // If message list isn't found yet, try again soon
      setTimeout(setupMessageListObserver, 500);
    }
  }

  // Local debounce implementation to avoid dependency issues
  function debounceScroll(func, wait) {
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

  // Set up observer for conversation list
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
              Translation.clearCache();

              const messageBodies = document.querySelectorAll(".message-body");
              messageBodies.forEach((messageBody) => {
                UI.processMessageBody(messageBody);
              });
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

  // Set up observer for the input area
  function setupInputObserver() {
    // Create a new observer
    const inputObserver = new MutationObserver(function (mutations) {
      // Check if our translation buttons are missing
      if (!document.getElementById("translation-buttons-container")) {
        UI.setupOutgoingTranslation();
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

  // Expose public methods
  return {
    setupObservers: setupObservers,
    setupConversationListObserver: setupConversationListObserver,
    setupInputObserver: setupInputObserver,
  };
})();
