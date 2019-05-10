// WrenVM is the class that the user interacts with after creating one
// via WrenJS.NewVM(config).
class WrenVM {
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
  interpret(module, source) {
    return Promise.resolve(this.interpretFn(this.ID, module, source))
  }
  // Call attempts to call the given handle with the assumption that the handle is valid and there is a receiver in place.
  call(handle) {
    return this.callFn(this.ID, handle)
  }

  free() {
    Module.freeVM(this.ID)
  }

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
  getForeignClassAllocator(module, className) {
    if (!this.foreignClasses[module] || !this.foreignClasses[module][className]) {
      return null
    }
    return this.foreignClasses[module][className].allocator
  }
  getForeignClassFinalizer(module, className) {
    if (!this.foreignClasses[module] || !this.foreignClasses[module][className]) {
      return null
    }
    return this.foreignClasses[module][className].finalizer
  }
  collectGarbage() {
    Module._wrenCollectGarbage(this.ID)
  }
  /* */
  ensureSlots(count) {
    Module._wrenEnsureSlots(this.ID, count)
  }
  getSlotCount() {
    return Module._wrenGetSlotCount(this.ID)
  }
  getSlotType(slot) {
    return Module._wrenGetSlotType(this.ID, slot)
  }
  getSlotDouble(slot) {
    return Module._wrenGetSlotDouble(this.ID, slot)
  }
  setSlotDouble(slot, value) {
    Module._wrenSetSlotDouble(this.ID, slot, value)
  }
  getSlotString(slot) {
    return UTF8ToString(Module._wrenGetSlotString(this.ID, slot))
  }
  setSlotString(slot, string) {
    var strLen = lengthBytesUTF8(string)
    var strOnHeap = _malloc(strLen+1)
    stringToUTF8(string, strOnHeap, strLen+1)
    Module._wrenSetSlotString(this.ID, slot, strOnHeap)
    _free(strOnHeap)
  }
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
  setSlotBytes(slot, typedArray) {
    // Assuming we have a proper typedArray here
    var numBytes  = typedArray.length * typedArray.BYTES_PER_ELEMENT
    var ptr       = _malloc(numBytes)
    var heapBytes = new Uint8Array(Module.HEAPU8.buffer, ptr, numBytes)
    heapBytes.set(new Uint8Array(typedArray.buffer))

    Module._wrenSetSlotBytes(this.ID, slot, heapBytes.byteOffset, heapBytes.length)

    _free(heapBytes.byteOffset)
  }
  getSlotBool(slot) {
    return Module._wrenGetSlotBool(this.ID, slot)
  }
  setSlotBool(slot, value) {
    Module._wrenSetSlotBool(this.ID, slot, value)
  }
  setSlotNull(slot) {
    Module._wrenSetSlotNull(this.ID, slot)
  }
  getSlotForeign(slot) {
    return Module._wrenGetSlotForeign(this.ID, slot)
  }
  setSlotNewForeign(slot, classSlot, size) {
    return Module._wrenSetSlotNewForeign(this.ID, slot, classSlot, size)
  }
  setSlotNewList(slot) {
    Module._wrenSetSlotNewList(this.ID, slot)
  }
  getListCount(slot) {
    return Module._wrenGetListCount(this.ID, slot)
  }
  getListElement(listSlot, index, elementSlot) {
    Module._wrenGetListElement(this.ID, listSlot, index, elementSlot)
  }
  insertInList(slot, index, element) {
    Module._wrenInsertInList(this.ID, slot, index, element)
  }
  getVariable(module, name, slot) {
    var moduleLen = lengthBytesUTF8(module)
    var moduleOnHeap = _malloc(moduleLen+1)
    stringToUTF8(module, moduleOnHeap, moduleLen+1)
    var nameLen = lengthBytesUTF8(name)
    var nameOnHeap = _malloc(nameLen+1)
    stringToUTF8(name, nameOnHeap, nameLen+1)

    var res = Module._wrenGetVariable(this.ID, moduleOnHeap, nameOnHeap, slot)

    _free(nameOnHeap)
    _free(moduleOnHeap)
    return res
  }
  getSlotHandle(slot) {
    return Module._wrenGetSlotHandle(this.ID, slot)
  }
  setSlotHandle(slot, handle) {
    Module._wrenSetSlotHandle(this.ID, slot, handle)
  }
  makeCallHandle(signature) {
    var signatureLen = lengthBytesUTF8(signature)
    var signatureOnHeap = _malloc(signatureLen+1)
    stringToUTF8(signature, signatureOnHeap, signatureLen+1)

    var res = Module._wrenMakeCallHandle(this.ID, signatureOnHeap)

    _free(signatureOnHeap)
    return res
  }
  releaseHandle(handle) {
    Module._wrenReleaseHandle(this.ID, handle)
  }
  abortFiber(slot) {
    Module._wrenAbortFiber(this.ID, slot)
  }
  // importFile adds the given file as an importable module. It returns a Promise.
  // Only usable if the "IMPORT_JSVM_ENABLED" flag is enabled during compilation.
  // This _must_ be called before the interpret is called.
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
  importFiles(files) {
    return Promise.all(files.map(file => this.importFile(file)))
  }
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