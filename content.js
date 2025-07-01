// content.js - wrapper script for translation bubble injection
(function () {
  // Show notification that authorization code is required
  function showAPIKeyNotification() {
    if (document.getElementById('api-key-notification')) return;

    const notification = document.createElement('div');
    notification.id = 'api-key-notification';
    notification.style.position = 'fixed';
    notification.style.top = '10px';
    notification.style.right = '10px';
    notification.style.backgroundColor = '#f44336';
    notification.style.color = 'white';
    notification.style.padding = '15px';
    notification.style.borderRadius = '5px';
    notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    notification.style.zIndex = '9999';
    notification.style.maxWidth = '300px';
    notification.innerHTML = `
      <div style="font-weight:bold;margin-bottom:5px;">Authorization Required</div>
      <div style="margin-bottom:10px;">Please set the server authorization code in the extension settings.</div>
      <div style="font-size:12px;">Click the extension icon to add your code.</div>
      <button id="dismiss-notification" style="margin-top:10px;padding:5px 10px;background:white;color:#f44336;border:none;border-radius:3px;cursor:pointer;">Dismiss</button>`;
    document.body.appendChild(notification);
    document.getElementById('dismiss-notification').addEventListener('click', function () {
      notification.remove();
    });
    setTimeout(() => {
      if (notification.parentNode) notification.remove();
    }, 10000);
  }

  function initializeTranslator() {
    setTimeout(() => {
      document.querySelectorAll('.message-body').forEach((messageBody) => {
        UI.processMessageBody(messageBody);
      });
      UI.setupOutgoingTranslation();
      Observers.setupObservers();
    }, 1000);
  }

  function handleMessages(request, sender, sendResponse) {
    if (request.action === 'updateSettings') {
      const settings = Translation.getSettings();
      Object.assign(settings, request.settings);
      if (settings.translationMode !== 'off') {
        if (!settings.authCode) {
          showAPIKeyNotification();
        }
        document.querySelectorAll('.translation-container').forEach((el) => el.remove());
        initializeTranslator();
      } else {
        document.querySelectorAll('.translation-container').forEach((el) => el.remove());
      }
      sendResponse({ success: true });
      return true;
    }
  }

  async function initialize() {
    try {
      await Translation.initSettings();
      const settings = Translation.getSettings();
      if (settings.translationMode !== 'off') {
        if (!settings.authCode) {
          showAPIKeyNotification();
        }
        initializeTranslator();
      }
      chrome.runtime.onMessage.addListener(handleMessages);
    } catch (err) {
      console.error('Error initializing extension:', err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();
