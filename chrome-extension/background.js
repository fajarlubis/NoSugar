// background.js
// This background script acts as a mediator between popup and content scripts

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "saveSettings") {
    // Store settings in Chrome storage
    chrome.storage.sync.set(message.settings, () => {
      // Notify all content scripts about the settings change
      broadcastToContentScripts(message);
      // Respond to popup
      sendResponse({ success: true, message: "Settings saved and broadcast" });
    });
    // Return true to indicate asynchronous response
    return true;
  }

  // If asking if any tabs are available for translation
  if (message.action === "checkForTranslatableTabs") {
    chrome.tabs.query({}, (tabs) => {
      // check it later for counting tab using this plugin
      sendResponse({
        hasTranslatableTabs: tabs.length > 0,
        count: tabs.length,
      });
    });
    return true;
  }
});

// Function to broadcast a message to all content scripts
function broadcastToContentScripts(message) {
  // Find all tabs that match our URL patterns
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      try {
        chrome.tabs
          .sendMessage(tab.id, {
            action: "updateSettings",
            settings: message.settings,
          })
          .catch(() => {
            // Silently ignore errors if tab doesn't respond
            console.log(`Tab ${tab.id} did not receive the message`);
          });
      } catch (error) {
        // Silently catch errors
        console.log(`Error sending to tab ${tab.id}: ${error.message}`);
      }
    }
  });
}

// Listen for tab updates to inject or refresh content script if needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only proceed if the tab is fully loaded and URL matches our patterns
  if (changeInfo.status === "complete") {
    // Check if we need to re-inject or refresh our settings
    chrome.storage.sync.get(
      {
        translationMode: "auto",
        targetLanguage: "en",
        authCode: "",
        useCustomServer: false,
        customServerAddress: "",
        customServerPort: "",
        translationPlacement: "bottom",
      },
      (settings) => {
        // Send the current settings to the newly loaded tab
        try {
          chrome.tabs
            .sendMessage(tabId, {
              action: "updateSettings",
              settings: settings,
            })
            .catch(() => {
              // Tab might not have content script yet, which is fine
            });
        } catch (error) {
          // Silently ignore errors
        }
      }
    );
  }
});
