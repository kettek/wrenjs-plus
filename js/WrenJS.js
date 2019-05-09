var LibraryWren = {
  WrenJS_errorFn: function(id, type, module, line, message) {
    var vm = window.WrenJS.getVM(id)
    if (vm) {
      vm.errorFn(type, UTF8ToString(module), line, UTF8ToString(message))
    }
  },
  WrenJS_writeFn: function(id, text) {
    var vm = window.WrenJS.getVM(id)
    if (vm) {
      vm.writeFn(UTF8ToString(text))
    }
  },
  WrenJS_getForeignMethod: function(id, module, className, isStatic, signature) {
    var vm = window.WrenJS.getVM(id)
    if (vm) {
      // This should return > 0 if it exists. 0 if it does not.
      var funcID = vm.getForeignMethod(UTF8ToString(module), UTF8ToString(className), isStatic, UTF8ToString(signature))
      return funcID
    }
    return 0
  },
  WrenJS_getForeignClassAllocator: function(id, module, className) {
    var vm = window.WrenJS.getVM(id)
    if (vm) {
      return vm.getForeignClassAllocator(UTF8ToString(module), UTF8ToString(className))
    }
    return 0
  },
  WrenJS_getForeignClassFinalizer: function(id, module, className) {
    var vm = window.WrenJS.getVM(id)
    if (vm) {
      return vm.getForeignClassFinalizer(UTF8ToString(module), UTF8ToString(className))
    }
    return 0
  },
  // isFileAvailable checks if the given file path exists as the target of a script tag.
  // This is only used if WrenJS+ was built with IMPORT_FROM_FETCH and defined LIMIT_FETCH_TO_SCRIPTS.
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
  // importFileFromVM is a call to request a VM-defined wren `import "..."`.
  // This is only used if WrenJS+ was built with IMPORT_FROM_JSVM.
  WrenJS_importFileFromVM: function(vm, file, return_string, return_bytes) {
    var vm = window.WrenJS.getVM(vm)
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