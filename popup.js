// popup.js
document.addEventListener("DOMContentLoaded", function () {
  // Check if we have translatable tabs
  checkForTranslatableTabs();

  // Load saved settings
  chrome.storage.sync.get(
    {
      translationMode: "auto",
      targetLanguage: "en",
      apiKey: "",
    },
    function (data) {
      // Set form values to saved values
      document.querySelector(
        `input[name="translationMode"][value="${data.translationMode}"]`
      ).checked = true;
      document.querySelector(
        `input[name="targetLanguage"][value="${data.targetLanguage}"]`
      ).checked = true;
      document.getElementById("apiKey").value = data.apiKey;
    }
  );

  // Toggle password visibility
  const toggleButton = document.querySelector(".toggle-password");
  const apiKeyInput = document.getElementById("apiKey");
  const eyeIcon = document.getElementById("eye-icon");
  const eyeSlashIcon = document.getElementById("eye-slash-icon");

  toggleButton.addEventListener("click", function (e) {
    // Prevent any potential form submission
    e.preventDefault();

    // Toggle input type between "password" and "text"
    if (apiKeyInput.type === "password") {
      apiKeyInput.type = "text";
      eyeIcon.style.display = "none";
      eyeSlashIcon.style.display = "block";
    } else {
      apiKeyInput.type = "password";
      eyeIcon.style.display = "block";
      eyeSlashIcon.style.display = "none";
    }
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
      const apiKey = document.getElementById("apiKey").value;

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
            apiKey: apiKey,
          },
        },
        function (response) {
          // Update status based on response
          if (response && response.success) {
            status.textContent = "Settings saved!";
          } else {
            status.textContent = "Settings saved! (Some tabs may need refresh)";
          }

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
        <p>You need a Google Cloud API key with Translation API enabled. <a href="https://cloud.google.com/translate/docs/setup" target="_blank">Learn how to get one</a>.</p>
      `;
      } else {
        // No translatable tabs open
        note.innerHTML = `
        <p><strong>No chat tabs detected.</strong> Please open a chat tab for translation to work.</p>
        <p>You need a Google Cloud API key with Translation API enabled. <a href="https://cloud.google.com/translate/docs/setup" target="_blank">Learn how to get one</a>.</p>
      `;
      }
    }
  );
}
