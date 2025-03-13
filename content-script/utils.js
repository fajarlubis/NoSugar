// content-script/utils.js
var Utils = (function () {
  // Debounce utility to limit frequent function calls
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

  // Expose public methods
  return {
    debounce: debounce,
  };
})();
