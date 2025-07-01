// popup.js
document.addEventListener("DOMContentLoaded", function () {
  // Check if we have translatable tabs
  checkForTranslatableTabs();

  // Load saved settings
  chrome.storage.sync.get(
    {
      translationMode: "auto",
      targetLanguage: "en",
      authCode: "",
      useCustomServer: false,
      customServerAddress: "",
      translationPlacement: "bottom",
    },
    function (data) {
      // Set form values to saved values
      document.querySelector(
        `input[name="translationMode"][value="${data.translationMode}"]`
      ).checked = true;
      document.querySelector(
        `input[name="targetLanguage"][value="${data.targetLanguage}"]`
      ).checked = true;
      document.getElementById("authCode").value = data.authCode;
      document.getElementById("useCustomServer").checked = data.useCustomServer;
      document.getElementById("serverAddress").value = data.customServerAddress || "";
      document.getElementById("customServerFields").style.display = data.useCustomServer ? "block" : "none";
      document.querySelector(`input[name="translationPlacement"][value="${data.translationPlacement || "bottom"}"]`).checked = true;

      connectWebSocket(data);
    }
  );

  const authCodeInput = document.getElementById("authCode");
  const copyButton = document.getElementById("copyAuthCode");

  const customCheckbox = document.getElementById("useCustomServer");
  const customFields = document.getElementById("customServerFields");

  customCheckbox.addEventListener("change", function () {
    customFields.style.display = this.checked ? "block" : "none";
  });

  copyButton.addEventListener("click", function (e) {
    e.preventDefault();
    navigator.clipboard.writeText(authCodeInput.value);
  });

  // Form submission handler
  document
    .getElementById("settingsForm")
    .addEventListener("submit", function (event) {
      // Always prevent the default form submission
      event.preventDefault();

      // Get current values
      const translationMode = document.querySelector(
        'input[name="translationMode"]:checked'
      ).value;
      const targetLanguage = document.querySelector(
        'input[name="targetLanguage"]:checked'
      ).value;
      const authCode = document.getElementById("authCode").value;
      const useCustomServer = document.getElementById("useCustomServer").checked;
      const serverAddress = document.getElementById("serverAddress").value;
      const translationPlacement = document.querySelector(
        'input[name="translationPlacement"]:checked'
      ).value;

      // Show saving status
      const status = document.getElementById("status");
      status.textContent = "Saving...";

      // Use the background script to save settings and broadcast to all tabs
      chrome.runtime.sendMessage(
        {
          action: "saveSettings",
          settings: {
            translationMode: translationMode,
            targetLanguage: targetLanguage,
            authCode: authCode,
            useCustomServer: useCustomServer,
            customServerAddress: serverAddress,
            translationPlacement: translationPlacement,
          },
        },
        function (response) {
          // Update status based on response
          if (response && response.success) {
            status.textContent = "Settings saved!";
          } else {
            status.textContent = "Settings saved! (Some tabs may need refresh)";
          }

          connectWebSocket({
            translationMode: translationMode,
            targetLanguage: targetLanguage,
            authCode: authCode,
            useCustomServer: useCustomServer,
            customServerAddress: serverAddress,
            translationPlacement: translationPlacement,
          });

          // Clear status message after a delay
          setTimeout(function () {
            status.textContent = "";
          }, 2000);
        }
      );
    });
});

// Function to check if we have translatable tabs
function checkForTranslatableTabs() {
  chrome.runtime.sendMessage(
    {
      action: "checkForTranslatableTabs",
    },
    function (response) {
      // Update UI based on whether we have translatable tabs
      const note = document.querySelector(".note");

      if (response && response.hasTranslatableTabs) {
        // We have tabs - normal operation
        note.innerHTML = `
        <p>Translation is active on ${response.count} tab${
          response.count === 1 ? "" : "s"
        }.</p>
        <p>Provide an authorization code for the default server or configure your own.</p>
      `;
      } else {
        // No translatable tabs open
        note.innerHTML = `
        <p><strong>No chat tabs detected.</strong> Please open a chat tab for translation to work.</p>
        <p>Provide an authorization code for the default server or configure your own.</p>
      `;
      }
    }
  );
}

// WebSocket connection for server status
let ws;
function connectWebSocket(settings) {
  const base = (() => {
    if (settings.useCustomServer && settings.customServerAddress) {
      return settings.customServerAddress.startsWith("http")
        ? settings.customServerAddress
        : `http://${settings.customServerAddress}`;
    }
    return "https://nosugar.fajarlubis.me";
  })();

  let wsUrl = base;
  if (wsUrl.startsWith("https://")) {
    wsUrl = wsUrl.replace("https://", "wss://");
  } else if (wsUrl.startsWith("http://")) {
    wsUrl = wsUrl.replace("http://", "ws://");
  } else if (!wsUrl.startsWith("ws")) {
    wsUrl = `ws://${wsUrl}`;
  }
  if (!wsUrl.endsWith("/ws")) {
    wsUrl += "/ws";
  }

  try {
    if (ws) {
      ws.close();
    }
    ws = new WebSocket(wsUrl);
    const el = document.getElementById("wsStatus");
    ws.onopen = function () {
      el.classList.add("connected");
    };
    ws.onclose = function () {
      el.classList.remove("connected");
    };
    ws.onerror = function () {
      el.classList.remove("connected");
    };
  } catch (e) {
    const el = document.getElementById("wsStatus");
    el.classList.remove("connected");
  }
}
