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
      customServerPort: "",
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
      document.getElementById("serverPort").value = data.customServerPort || "";
      document.getElementById("customServerFields").style.display = data.useCustomServer ? "block" : "none";
      document.querySelector(`input[name="translationPlacement"][value="${data.translationPlacement || "bottom"}"]`).checked = true;
    }
  );

  // Toggle password visibility
  const toggleButton = document.querySelector(".toggle-password");
  const authCodeInput = document.getElementById("authCode");
  const eyeIcon = document.getElementById("eye-icon");
  const eyeSlashIcon = document.getElementById("eye-slash-icon");

  const customCheckbox = document.getElementById("useCustomServer");
  const customFields = document.getElementById("customServerFields");

  customCheckbox.addEventListener("change", function () {
    customFields.style.display = this.checked ? "block" : "none";
  });

  toggleButton.addEventListener("click", function (e) {
    // Prevent any potential form submission
    e.preventDefault();

    // Toggle input type between "password" and "text"
    if (authCodeInput.type === "password") {
      authCodeInput.type = "text";
      eyeIcon.style.display = "none";
      eyeSlashIcon.style.display = "block";
    } else {
      authCodeInput.type = "password";
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
      const authCode = document.getElementById("authCode").value;
      const useCustomServer = document.getElementById("useCustomServer").checked;
      const serverAddress = document.getElementById("serverAddress").value;
      const serverPort = document.getElementById("serverPort").value;
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
            customServerPort: serverPort,
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
