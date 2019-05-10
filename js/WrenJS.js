/**
 * @fileoverview LibraryWren provides the JavaScript functions available to C.
 * @package
 */
var LibraryWren = {
  /**
   * Provides the C to WrenJS to WrenVM interface for handling Wren's error function.
   * @param {number} id 
   * @param {number} type 
   * @param {string} module 
   * @param {number} line 
   * @param {string} message 
   */
  WrenJS_errorFn: function(id, type, module, line, message) {
    var vm = WrenJS.getVM(id)
    if (vm) {
      vm.errorFn(type, UTF8ToString(module), line, UTF8ToString(message))
    }
  },
  /**
   * Provides the C to WrenJS to WrenVM interface for handling Wren's write function.
   * @param {number} id 
   * @param {string} text 
   */
  WrenJS_writeFn: function(id, text) {
    var vm = WrenJS.getVM(id)
    if (vm) {
      vm.writeFn(UTF8ToString(text))
    }
  },
  /** 
   * Returns a VM's foreign method to C.
   * @param {number} id 
   * @param {string} module 
   * @param {string} className 
   * @param {boolean} isStatic 
   * @param {string} signature 
   * @return {function}
   */
  WrenJS_getForeignMethod: function(id, module, className, isStatic, signature) {
    var vm = WrenJS.getVM(id)
    if (vm) {
      // This should return > 0 if it exists. 0 if it does not.
      var funcID = vm.getForeignMethod(UTF8ToString(module), UTF8ToString(className), isStatic, UTF8ToString(signature))
      return funcID
    }
    return 0
  },
  /**
   * Returns a VM's foreign class allocator to C.
   * @param {number} id 
   * @param {string} module 
   * @param {string} className 
   * @return {function}
   */
  WrenJS_getForeignClassAllocator: function(id, module, className) {
    var vm = WrenJS.getVM(id)
    if (vm) {
      return vm.getForeignClassAllocator(UTF8ToString(module), UTF8ToString(className))
    }
    return 0
  },
  /**
   * Returns a VM's foreign class finalizer(destructor) to C.
   * @param {number} id 
   * @param {string} module 
   * @param {string} className 
   * @return {function}
   */
  WrenJS_getForeignClassFinalizer: function(id, module, className) {
    var vm = WrenJS.getVM(id)
    if (vm) {
      return vm.getForeignClassFinalizer(UTF8ToString(module), UTF8ToString(className))
    }
    return 0
  },
  /**
   * Returns whether or not a file has been defined as a wren script in the document's head.
   * This is not used if WrenJS+ was built with ALLOW_NONSCRIPT_FETCH.
   * @param {string} file 
   * @return {boolean}
   */
  WrenJS_isFileAvailable: function(file) {
    file = UTF8ToString(file)
    var wrenScripts = Array.from(document.head.getElementsByTagName("script"))
                      .filter(script => script.getAttribute("type") == "text/wren")
                      .filter(script => script.getAttribute("src") == file)
    if (wrenScripts.length > 0) {
      return true
    }
    return false
  },
  /**
   * Requests a VM-defined result for a Wren import statement.
   * This is not used if WrenJS+ was built with DISABLE_JSVM_IMPORT.
   * @param {number} vm 
   * @param {string} file 
   * @param {number} return_string 
   * @param {number} return_bytes 
   */
  WrenJS_importFileFromVM: function(vm, file, return_string, return_bytes) {
    var vm = WrenJS.getVM(vm)
    if (vm) {
      var text = vm.getImportedFile(UTF8ToString(file))
      if (!text) return
      var strLen = lengthBytesUTF8(text)
      var strOnHeap = _malloc(strLen+1)
      stringToUTF8(text, strOnHeap, strLen+1)
      setValue(return_string, strOnHeap, '*')
      setValue(return_bytes, lengthBytesUTF8(text), 'i32')
    }
  },
}

mergeInto(LibraryManager.library, LibraryWren)