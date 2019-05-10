(function(){
var Module = {
  noInitialRun: true,
  postRun: function() {
    if (Module.dispatchEvent) {
      Module.dispatchEvent(new CustomEvent("ready"));
    } else if (Module.emit) {
      Module.emit("ready")
    }
  }
}
