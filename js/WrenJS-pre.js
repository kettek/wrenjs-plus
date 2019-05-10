WrenJS.noInitialRun = true

WrenJS.postRun = function() {
  if (WrenJS.dispatchEvent) {
    WrenJS.dispatchEvent(new CustomEvent("ready"));
  } else if (WrenJS.emit) {
    WrenJS.emit("ready")
  }
}