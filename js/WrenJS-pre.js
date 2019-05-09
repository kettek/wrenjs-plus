var Module = {
  noInitialRun: true,
  postRun: function() {
    window.WrenJS.dispatchEvent(new CustomEvent("ready"));
  }
}
