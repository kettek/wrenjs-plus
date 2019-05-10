// WrenVM is the class that the user interacts with after creating one
// via WrenJS.NewVM(config).
class WrenVM {
  /**
   * Constructor for WrenVM.
   * @param {number} id This is the emscripten numerical pointer to a WrenVM instance.
   * @param {object} config This optional object can provide a writeFn(string) or an errorFn(type, module, line, message) handler.
   */
  constructor(id, config) {
    this.ID = id

    this.writeFn = config.writeFn || function() {}
    this.errorFn = config.errorFn || function() {}

    this.foreignFunctions = {}
    this.foreignClasses = {}

    // This could, and probably should, use a cached value from WrenJS.
    this.interpretFn = Module.cwrap('wrenInterpret', 'number', ['number', 'string', 'string'], {async: true})
    //this.callFn = Module.cwrap('wrenCall', 'number', ['number', 'number'], {async: true})
    this.callFn = Module.cwrap('wrenCall', 'number', ['number', 'number'], {async: false})

    // importedFiles is a file->source map used for VM-based imports via importFile(s).
    this.importedFiles = {}
  }

  // Interpret attempts to interpret the module and source. Returns a Promise with an argument of WrenInterpretResult
  /**
   * Runs the VM interpreter in the given module space with the provided source.
   * @param {string} module 
   * @param {string} source 
   * @returns {Promise}
   */
  interpret(module, source) {
    return Promise.resolve(this.interpretFn(this.ID, module, source))
  }
  /**
   * Calls the given handle. This presumes Wren slots have been set up appropriately.
   * @param {number} handle 
   */
  call(handle) {
    return this.callFn(this.ID, handle)
  }

  /**
   * Frees up the VM. You must call `releaseHandle` on all your handles first.
   */
  free() {
    Module.freeVM(this.ID)
  }

  /**
   * Adds a foreign method to the VM.
   * @param {string} module 
   * @param {string} className 
   * @param {bool} isStatic 
   * @param {string} signature 
   * @param {function} cb 
   */
  addForeignMethod(module, className, isStatic, signature, cb) {
    if (!this.foreignFunctions[module]) {
      this.foreignFunctions[module] = {}
    }
    if (!this.foreignFunctions[module][className]) {
      this.foreignFunctions[module][className] = {}
    }
    if (!this.foreignFunctions[module][className][isStatic]) {
      this.foreignFunctions[module][className][isStatic] = {}
    }
    if (!this.foreignFunctions[module][className][isStatic][signature]) {
      this.foreignFunctions[module][className][isStatic][signature] = Module.addFunction(cb)
    } else {
      console.log("FIXME: foreign method defined twice")
    }
  }
  /**
   * Returns a foreign method.
   * @param {string} module 
   * @param {string} className 
   * @param {bool} isStatic 
   * @param {string} signature 
   */
  getForeignMethod(module, className, isStatic, signature) {
    if (!this.foreignFunctions[module]) {
      return 0
    }
    if (!this.foreignFunctions[module][className]) {
      return 0
    }
    if (!this.foreignFunctions[module][className][isStatic]) {
      return 0
    }
    if (!this.foreignFunctions[module][className][isStatic][signature]) {
      return 0
    }
    return this.foreignFunctions[module][className][isStatic][signature]
  }
  /**
   * Adds a foreign class allocator and finalizer.
   * @param {string} module 
   * @param {string} className 
   * @param {function} allocator 
   * @param {function} finalizer 
   */
  addForeignClassMethods(module, className, allocator, finalizer) {
    if (!this.foreignClasses[module]) {
      this.foreignClasses[module] = {}
    }
    if (!this.foreignClasses[module][className]) {
      this.foreignClasses[module][className] = {
        allocator: Module.addFunction(allocator),
        finalizer: Module.addFunction(finalizer),
      }
    } else {
      console.log("FIXME: foreign class defined twice")
    }
  }
  /**
   * Returns the allocator for a foreign class.
   * @param {string} module 
   * @param {string} className 
   * @returns {WrenForeignMethodFn}
   */
  getForeignClassAllocator(module, className) {
    if (!this.foreignClasses[module] || !this.foreignClasses[module][className]) {
      return null
    }
    return this.foreignClasses[module][className].allocator
  }
  /**
   * 
   * @param {string} module 
   * @param {string} className 
   * @returns {WrenFinalizerFn}
   */
  getForeignClassFinalizer(module, className) {
    if (!this.foreignClasses[module] || !this.foreignClasses[module][className]) {
      return null
    }
    return this.foreignClasses[module][className].finalizer
  }
  /**
   * Calls the VM's garbage collection routine.
   */
  collectGarbage() {
    Module._wrenCollectGarbage(this.ID)
  }
  /**
   * Ensures that the VM has the defined amount of slots available for use.
   * @param {number} count 
   */
  ensureSlots(count) {
    Module._wrenEnsureSlots(this.ID, count)
  }
  /**
   * Gets the amount of slots currently used.
   * @returns {number}
   */
  getSlotCount() {
    return Module._wrenGetSlotCount(this.ID)
  }
  /**
   * Returns the WrenType stored in a given slot.
   * @param {number} slot 
   * @returns {number}
   */
  getSlotType(slot) {
    return Module._wrenGetSlotType(this.ID, slot)
  }
  /**
   * Returns a floating point number stored in a given slot.
   * @param {number} slot 
   * @returns {number}
   */
  getSlotDouble(slot) {
    return Module._wrenGetSlotDouble(this.ID, slot)
  }
  /**
   * Sets the given slot to the provided floating point number.
   * @param {number} slot 
   * @param {number} value 
   */
  setSlotDouble(slot, value) {
    Module._wrenSetSlotDouble(this.ID, slot, value)
  }
  /**
   * Returns a string stored in the given slot.
   * @param {number} slot 
   * @returns {string}
   */
  getSlotString(slot) {
    return UTF8ToString(Module._wrenGetSlotString(this.ID, slot))
  }
  /**
   * Sets the given slot to the provided string.
   * @param {number} slot 
   * @param {string} string 
   */
  setSlotString(slot, string) {
    var strLen = lengthBytesUTF8(string)
    var strOnHeap = _malloc(strLen+1)
    stringToUTF8(string, strOnHeap, strLen+1)
    Module._wrenSetSlotString(this.ID, slot, strOnHeap)
    _free(strOnHeap)
  }
  /**
   * Returns a Uint8Array of bytes stored in the given slot.
   * @param {number} slot 
   * @returns {Uint8Array}
   */
  getSlotBytes(slot) {
    var lenPtr    = _malloc(4) // ??
    var bytesPtr  = Module._wrenGetSlotBytes(this.ID, slot, lenPtr)
    var length    = getValue(lenPtr, 'i32')
    _free(lenPtr)

    // This seems heavy.
    var bytes = new Uint8Array(length)
    for (var i = 0; i < length; i++) {
      bytes[i] = getValue(bytesPtr+i, 'i8')
    }

    return bytes
  }
  /**
   * Sets the given slot to the provided TypedArray. Provided data will be converted to a Uint8Array.
   * @param {number} slot 
   * @param {TypedArray} typedArray 
   */
  setSlotBytes(slot, typedArray) {
    // Assuming we have a proper typedArray here
    var numBytes  = typedArray.length * typedArray.BYTES_PER_ELEMENT
    var ptr       = _malloc(numBytes)
    var heapBytes = new Uint8Array(Module.HEAPU8.buffer, ptr, numBytes)
    heapBytes.set(new Uint8Array(typedArray.buffer))

    Module._wrenSetSlotBytes(this.ID, slot, heapBytes.byteOffset, heapBytes.length)

    _free(heapBytes.byteOffset)
  }
  /**
   * Returns the boolean value of a given slot.
   * @param {number} slot 
   * @returns {boolean}
   */
  getSlotBool(slot) {
    return Module._wrenGetSlotBool(this.ID, slot)
  }
  /**
   * Sets the given slot to the provided boolean value.
   * @param {number} slot 
   * @param {boolean} value 
   */
  setSlotBool(slot, value) {
    Module._wrenSetSlotBool(this.ID, slot, value)
  }
  /**
   * Sets the given slot to null.
   * @param {number} slot 
   */
  setSlotNull(slot) {
    Module._wrenSetSlotNull(this.ID, slot)
  }
  /**
   * Returns a foreign object from the provided slot.
   * @param {number} slot 
   * @returns {number}
   */
  getSlotForeign(slot) {
    return Module._wrenGetSlotForeign(this.ID, slot)
  }
  /**
   * Sets the given slot to a new foreign object with an optional size for extra bytes storage.
   * @param {number} slot 
   * @param {number} classSlot 
   * @param {number} size 
   * @returns {number} pointer to the extra bytes.
   */
  setSlotNewForeign(slot, classSlot, size) {
    return Module._wrenSetSlotNewForeign(this.ID, slot, classSlot, size)
  }
  /**
   * Sets the given slot to a new list.
   * @param {number} slot 
   */
  setSlotNewList(slot) {
    Module._wrenSetSlotNewList(this.ID, slot)
  }
  /**
   * Returns the number of items in a list in the given slot.
   * @param {number} slot 
   * @returns {number}
   */
  getListCount(slot) {
    return Module._wrenGetListCount(this.ID, slot)
  }
  /**
   * Moves an element from the given listSlot's index to target elementSlot.
   * @param {number} listSlot 
   * @param {number} index 
   * @param {number} elementSlot 
   */
  getListElement(listSlot, index, elementSlot) {
    Module._wrenGetListElement(this.ID, listSlot, index, elementSlot)
  }
  /**
   * Inserts the provided element in elementSlot into the index position in the list at slot.
   * @param {number} slot 
   * @param {number} index 
   * @param {number} elementSlot
   */
  insertInList(slot, index, elementSlot) {
    Module._wrenInsertInList(this.ID, slot, index, elementSlot)
  }
  /**
   * Gets a variable of the provided name in a module and sets it to the given slot.
   * @param {string} module 
   * @param {string} name 
   * @param {number} slot 
   */
  getVariable(module, name, slot) {
    var moduleLen = lengthBytesUTF8(module)
    var moduleOnHeap = _malloc(moduleLen+1)
    stringToUTF8(module, moduleOnHeap, moduleLen+1)
    var nameLen = lengthBytesUTF8(name)
    var nameOnHeap = _malloc(nameLen+1)
    stringToUTF8(name, nameOnHeap, nameLen+1)

    Module._wrenGetVariable(this.ID, moduleOnHeap, nameOnHeap, slot)

    _free(nameOnHeap)
    _free(moduleOnHeap)
  }
  /**
   * Returns the handle in the given slot.
   * @param {number} slot 
   * @returns {number}
   */
  getSlotHandle(slot) {
    return Module._wrenGetSlotHandle(this.ID, slot)
  }
  /**
   * Sets the given slot to the given handle.
   * @param {number} slot 
   * @param {number} handle 
   */
  setSlotHandle(slot, handle) {
    Module._wrenSetSlotHandle(this.ID, slot, handle)
  }
  /**
   * Creates and returns a handle that is usable in functions such as `call(handle)`.
   * You must call `releaseHandle(handle)` before you free the VM.
   * @param {string} signature 
   * @returns {number}
   */
  makeCallHandle(signature) {
    var signatureLen = lengthBytesUTF8(signature)
    var signatureOnHeap = _malloc(signatureLen+1)
    stringToUTF8(signature, signatureOnHeap, signatureLen+1)

    var res = Module._wrenMakeCallHandle(this.ID, signatureOnHeap)

    _free(signatureOnHeap)
    return res
  }
  /**
   * Release the given handle from the VM.
   * @param {number} handle 
   */
  releaseHandle(handle) {
    Module._wrenReleaseHandle(this.ID, handle)
  }
  /**
   * Aborts the fiber.
   * @param {number} slot 
   */
  abortFiber(slot) {
    Module._wrenAbortFiber(this.ID, slot)
  }
  // importFile adds the given file as an importable module. It returns a Promise.
  // Only usable if the "IMPORT_JSVM_ENABLED" flag is enabled during compilation.
  // This _must_ be called before the interpret is called.
  /**
   * Loads a given file via XHR and adds it to the importedFiles map.
   * Must be called before interpreting.
   * Does nothing if WrenJS+ was built with DISABLE_JSVM_IMPORT.
   * @param {string} file 
   * @returns {Promise}
   */
  importFile(file) {
    return new Promise((resolve, reject) => {
      var r = new XMLHttpRequest()
      r.onreadystatechange = () => {
        if (r.readyState !== 4) return
        if (r.status >= 200 && r.status < 300) {
          this.importedFiles[file] = r.responseText
          resolve(r)
        } else {
          reject(r)
        }
      }
      r.open('GET', file, true)
      r.send()
    })
  }
  /**
   * Calls importFile(...) on an array of strings.
   * @param {string[]} files 
   * @returns {Promise}
   */
  importFiles(files) {
    return Promise.all(files.map(file => this.importFile(file)))
  }
  /**
   * Returns the string contents of an imported file.
   * @param {string} file 
   * @returns {string}
   */
  getImportedFile(file) {
    return this.importedFiles[file]
  }
}

Module._listeners = {}
// Browser-esque listener implementation.
if (typeof window !== 'undefined') {
  Module.on = Module.addEventListener = function(t, cb) {
    if (!(t in Module._listeners)) {
      Module._listeners[t] = []
    }
    Module._listeners[t].push(cb)
  }
  Module.off = Module.removeEventListener = function(t, cb) {
      if (!(t in Module._listeners)) {
        return
      }
      var stack = Module._listeners[t]
      for (var i = 0, l = stack.length; i < l; i++) {
        if (stack[i] === cb) {
          stack.splice(i, 1)
          return
        }
      }
  }
  Module.emit = Module.dispatchEvent = function(e) {
    if (!(e.type in Module._listeners)) {
      return true
    }
    var stack = Module._listeners[e.type].slice()

    for (var i = 0, l = stack.length; i < l; i++) {
      stack[i].call(Module, e)
    }
    return !e.defaultPrevented
  }
  window.WrenJS = Module
}

// Node-esque listener implementation.
if (typeof module !== 'undefined') {
  Module.on = Module.addListener = function(t, cb) {
    if (!(t in Module._listeners)) {
      Module._listeners[t] = []
    }
    Module._listeners[t].push(cb)
  }
  Module.off = Module.removeListener = function(t, cb) {
    if (!(t in Module._listeners)) {
      return
    }
    var stack = Module._listeners[t]
    for (var i = 0, l = stack.length; i < l; i++) {
      if (stack[i] === cb) {
        stack.splice(i, 1)
        return
      }
    }
  }
  Module.emit = function(t) {
    if (!(t in Module._listeners)) {
      return true
    }
    var stack = Module._listeners[t].slice()

    for (var i = 0, l = stack.length; i < l; i++) {
      stack[i].call(Module, t)
    }
  }
  module.exports = Module
}

Module._VMs = {}
Module._addVM = function(vm) {
  return Module._VMs[vm.ID] = vm
}

Module.freeVM = function(id) {
  if (Module._VMs[id]) {
    Module._freeWrenVM(id)
    delete Module._VMs[id]
  }
}
Module.getVM = function(id) {
  return Module._VMs[id]
}

/**
 * Creates and returns a new WrenVM instance.
 * @param {object} config Provides a config object that can contain errorFn and/or writeFn.
 * @returns {WrenVM}
 */
Module.newVM = function(config) {
  return Module._addVM(new WrenVM(Module._makeWrenVM(), config || {}))
}

// Let's add a listener for ready ourselves so we can get appropriate constants
Module.on('ready', function() {
  // Get our WrenInterpretResults
  Module.RESULT_COMPILE_ERROR = Module._getWrenResultCompileError()
  Module.RESULT_RUNTIME_ERROR = Module._getWrenResultRuntimeError()
  Module.RESULT_SUCCESS       = Module._getWrenResultSuccess()
  // Get our WrenTypes
  Module.TYPE_BOOL            = Module._getWrenTypeBool()
  Module.TYPE_NUM             = Module._getWrenTypeNum()
  Module.TYPE_FOREIGN         = Module._getWrenTypeForeign()
  Module.TYPE_LIST            = Module._getWrenTypeList()
  Module.TYPE_NULL            = Module._getWrenTypeNull()
  Module.TYPE_STRING          = Module._getWrenTypeString()
  Module.TYPE_UNKNOWN         = Module._getWrenTypeUnknown()
  // Get our WrenErrorTypes
  Module.ERROR_COMPILE        = Module._getWrenErrorCompile()
  Module.ERROR_RUNTIME        = Module._getWrenErrorRuntime()
  Module.ERROR_STACK_TRACE    = Module._getWrenErrorStackTrace()
})

})()
