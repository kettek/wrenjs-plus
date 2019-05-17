/*
This file is a part of WrenJS+, an emscripten wrapper around Wren.
Copyright (C) 2019  Ketchetwahmeegwun T. Southall

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Lesser General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/
/**
 * WrenVM provides an object-oriented interface to the underlying Wren VM.
 * 
 * @example
 * WrenJS.addEventListener('ready', () => {
 *   var vm = WrenJS.newVM({
 *     writeFn: (text) => {
 *       console.log("stdout: %s", text)
 *     },
 *     errorFn: (type, module, line, message) => {
 *       console.log("stderr(%d): %s %d %s", type, module, line, message)
 *     }
 *   })
 *   vm.interpret("main", 'System.print("Hello, xorld!")')
 *   .then(result => {
 *     switch(result) {
 *       case WrenJS.RESULT_COMPILE_ERROR:
 *         console.log("Compilation error!")
 *         break
 *       case WrenJS.RESULT_RUNTIME_ERROR:
 *         console.log("Runtime error!")
 *         break
 *       case WrenJS.RESULT_SUCCESS:
 *         console.log("Success!")
 *         break
 *     }
 *     // vm.call(...), etc.
 *     vm.free()
 *   })
 * })
 */
class WrenVM {
  /**
   * Callback for WrenVM's writeFn.
   * @callback writeFn
   * @param {string} message - The string to output.
   */
  /**
   * Callback for WrenVM's errorFn.
   * @callback errorFn
   * @param {WrenJS.WrenErrorType} type - The type of error.
   * @param {string} module - The module that originated the error.
   * @param {number} line - The line on which the error occurred.
   * @param {string} message - The error message.
   */
  /**
   * Creates a WrenVM instance. This should only be called through WrenJS.newVM().
   * @param {number} id This is the emscripten numerical pointer to a WrenVM instance.
   * @param {object} config This optional object can provide a writeFn(string) or an errorFn(type, module, line, message) handler.
   * @param {writeFn} config.writeFn
   * @param {errorFn} config.errorFn
   */
  constructor(id, config) {
    this.ID = id

    this.writeFn = config.writeFn || function() {}
    this.errorFn = config.errorFn || function() {}

    this.foreignFunctions = {}
    this.foreignClasses = {}

    // This could, and probably should, use a cached value from WrenJS.
    this.interpretFn = WrenJS.cwrap('wrenInterpret', 'number', ['number', 'string', 'string'], {async: true})
    //this.callFn = WrenJS.cwrap('wrenCall', 'number', ['number', 'number'], {async: true})
    this.callFn = WrenJS.cwrap('wrenCall', 'number', ['number', 'number'], {async: false})

    // importedFiles is a file->source map used for VM-based imports via importFile(s).
    this.importedFiles = {}
  }

  /**
   * Runs the VM interpreter in the given module space with the provided source.
   * @param {string} module 
   * @param {string} source 
   * @returns {Promise}
   * @example
   * vm.interpret('main', 'System.print("Hello, xorld!")').then(result => {
   *   // Handle result.
   * })
   */
  interpret(module, source) {
    return Promise.resolve(this.interpretFn(this.ID, module, source))
  }
  /**
   * Calls the given handle. This presumes Wren slots have been set up appropriately.
   * @param {number} handle 
   * @example
   * vm.ensureSlots(2)
   * vm.getVariable("my_module", "myClass", 0)
   * var handle = vm.makeCallHandle("classMethod()")
   * vm.call(handle)
   * vm.releaseHandle(handle)
   */
  call(handle) {
    return this.callFn(this.ID, handle)
  }

  /**
   * Frees up the VM. You must call `releaseHandle` on all your handles first.
   */
  free() {
    WrenJS.freeVM(this.ID)
  }

  /**
   * Adds a foreign method to the VM.
   * @param {string} module 
   * @param {string} className 
   * @param {bool} isStatic 
   * @param {string} signature 
   * @param {function} cb 
   * @example
   * vm.addForeignMethod("wren/ForeignClass", "ForeignClass", 0, "add(_,_)", function() {
   *   var a = vm.getSlotDouble(1)
   *   var b = vm.getSlotDouble(2)
   *   vm.setSlotDouble(0, a+b)
   * })
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
      this.foreignFunctions[module][className][isStatic][signature] = WrenJS.addFunction(cb)
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
   * @private
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
   * @example
   * vm.addForeignClassMethods("wren/ForeignClass", "ForeignClass", function() {
   *   // Allocator
   *   vm.setSlotNewForeign(0, 0, 0)
   * }, function() {
   *   // Finalizer
   * })
   */
  addForeignClassMethods(module, className, allocator, finalizer) {
    if (!this.foreignClasses[module]) {
      this.foreignClasses[module] = {}
    }
    if (!this.foreignClasses[module][className]) {
      this.foreignClasses[module][className] = {
        allocator: WrenJS.addFunction(allocator),
        finalizer: WrenJS.addFunction(finalizer),
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
   * @private
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
   * @private
   */
  getForeignClassFinalizer(module, className) {
    if (!this.foreignClasses[module] || !this.foreignClasses[module][className]) {
      return null
    }
    return this.foreignClasses[module][className].finalizer
  }
  /**
   * Ensures that the VM has the defined amount of slots available for use.
   * @param {number} count 
   */
  ensureSlots(count) {
    WrenJS._wrenEnsureSlots(this.ID, count)
  }
  /**
   * Gets the amount of slots currently used.
   * @returns {number}
   */
  getSlotCount() {
    return WrenJS._wrenGetSlotCount(this.ID)
  }
  /**
   * Returns the WrenType stored in a given slot.
   * @param {number} slot 
   * @returns {number}
   */
  getSlotType(slot) {
    return WrenJS._wrenGetSlotType(this.ID, slot)
  }
  /**
   * Returns a floating point number stored in a given slot.
   * @param {number} slot 
   * @returns {number}
   */
  getSlotDouble(slot) {
    return WrenJS._wrenGetSlotDouble(this.ID, slot)
  }
  /**
   * Sets the given slot to the provided floating point number.
   * @param {number} slot 
   * @param {number} value 
   */
  setSlotDouble(slot, value) {
    WrenJS._wrenSetSlotDouble(this.ID, slot, value)
  }
  /**
   * Returns a string stored in the given slot.
   * @param {number} slot 
   * @returns {string}
   */
  getSlotString(slot) {
    return UTF8ToString(WrenJS._wrenGetSlotString(this.ID, slot))
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
    WrenJS._wrenSetSlotString(this.ID, slot, strOnHeap)
    _free(strOnHeap)
  }
  /**
   * Returns a Uint8Array of bytes stored in the given slot.
   * @param {number} slot 
   * @returns {Uint8Array}
   */
  getSlotBytes(slot) {
    var lenPtr    = _malloc(4) // ??
    var bytesPtr  = WrenJS._wrenGetSlotBytes(this.ID, slot, lenPtr)
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
    var heapBytes = new Uint8Array(WrenJS.HEAPU8.buffer, ptr, numBytes)
    heapBytes.set(new Uint8Array(typedArray.buffer))

    WrenJS._wrenSetSlotBytes(this.ID, slot, heapBytes.byteOffset, heapBytes.length)

    _free(heapBytes.byteOffset)
  }
  /**
   * Returns the boolean value of a given slot.
   * @param {number} slot 
   * @returns {boolean}
   */
  getSlotBool(slot) {
    return WrenJS._wrenGetSlotBool(this.ID, slot)
  }
  /**
   * Sets the given slot to the provided boolean value.
   * @param {number} slot 
   * @param {boolean} value 
   */
  setSlotBool(slot, value) {
    WrenJS._wrenSetSlotBool(this.ID, slot, value)
  }
  /**
   * Sets the given slot to null.
   * @param {number} slot 
   */
  setSlotNull(slot) {
    WrenJS._wrenSetSlotNull(this.ID, slot)
  }
  /**
   * Returns a foreign object from the provided slot.
   * @param {number} slot 
   * @returns {number}
   */
  getSlotForeign(slot) {
    return WrenJS._wrenGetSlotForeign(this.ID, slot)
  }
  /**
   * Sets the given slot to a new foreign object with an optional size for extra bytes storage.
   * @param {number} slot 
   * @param {number} classSlot 
   * @param {number} size 
   * @returns {number} pointer to the extra bytes.
   */
  setSlotNewForeign(slot, classSlot, size) {
    return WrenJS._wrenSetSlotNewForeign(this.ID, slot, classSlot, size)
  }
  /**
   * Sets the given slot to a new list.
   * @param {number} slot 
   */
  setSlotNewList(slot) {
    WrenJS._wrenSetSlotNewList(this.ID, slot)
  }
  /**
   * Returns the number of items in a list in the given slot.
   * @param {number} slot 
   * @returns {number}
   */
  getListCount(slot) {
    return WrenJS._wrenGetListCount(this.ID, slot)
  }
  /**
   * Moves an element from the given listSlot's index to target elementSlot.
   * @param {number} listSlot 
   * @param {number} index 
   * @param {number} elementSlot 
   */
  getListElement(listSlot, index, elementSlot) {
    WrenJS._wrenGetListElement(this.ID, listSlot, index, elementSlot)
  }
  /**
   * Inserts the provided element in elementSlot into the index position in the list at slot.
   * @param {number} slot 
   * @param {number} index 
   * @param {number} elementSlot
   */
  insertInList(slot, index, elementSlot) {
    WrenJS._wrenInsertInList(this.ID, slot, index, elementSlot)
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

    WrenJS._wrenGetVariable(this.ID, moduleOnHeap, nameOnHeap, slot)

    _free(nameOnHeap)
    _free(moduleOnHeap)
  }
  /**
   * Returns the handle in the given slot.
   * @param {number} slot 
   * @returns {number}
   */
  getSlotHandle(slot) {
    return WrenJS._wrenGetSlotHandle(this.ID, slot)
  }
  /**
   * Sets the given slot to the given handle.
   * @param {number} slot 
   * @param {number} handle 
   */
  setSlotHandle(slot, handle) {
    WrenJS._wrenSetSlotHandle(this.ID, slot, handle)
  }
  /**
   * Creates and returns a handle that is usable in functions such as `call(handle)`.
   * You must call `releaseHandle(handle)` before you free the VM.
   * @param {string} signature 
   * @returns {number}
   * @example
   * vm.ensureSlots(2)
   * vm.getVariable("my_module", "myClass", 0)
   * var handle = vm.makeCallHandle("foreignMethod()")
   * vm.call(handle)
   * vm.releaseHandle(handle)
   */
  makeCallHandle(signature) {
    var signatureLen = lengthBytesUTF8(signature)
    var signatureOnHeap = _malloc(signatureLen+1)
    stringToUTF8(signature, signatureOnHeap, signatureLen+1)

    var res = WrenJS._wrenMakeCallHandle(this.ID, signatureOnHeap)

    _free(signatureOnHeap)
    return res
  }
  /**
   * Release the given handle from the VM.
   * @param {number} handle 
   */
  releaseHandle(handle) {
    WrenJS._wrenReleaseHandle(this.ID, handle)
  }
  /**
   * Calls the VM's garbage collection routine.
   */
  collectGarbage() {
    WrenJS._wrenCollectGarbage(this.ID)
  }
  /**
   * Aborts the fiber.
   * @param {number} slot 
   */
  abortFiber(slot) {
    WrenJS._wrenAbortFiber(this.ID, slot)
  }
  /**
   * Loads a given file via XHR and adds it to the importedFiles map.
   * Must be called before interpreting.
   * Does nothing if WrenJS+ was built with DISABLE_JSVM_IMPORT.
   * @param {string} file 
   * @returns {Promise}
   * @example
   * vm.importFile("wren/testImport.wren")
   * .then(result => {
   *   vm.interpret(...)
   * })
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
   * @example
   * vm.importFiles(["wren/testImport.wren", "wren/testImport2.wren"])
   * .then(result => {
   *   vm.interpret(...)
   * })
   */
  importFiles(files) {
    return Promise.all(files.map(file => this.importFile(file)))
  }
  /**
   * Returns the string contents of an imported file.
   * @param {string} file 
   * @returns {string}
   * @private
   */
  getImportedFile(file) {
    return this.importedFiles[file]
  }
}

/**
 * WrenJS is the interface through which Wren VMs are created. Be aware that this is actually an Emscripten Module.
 * See [preamble.js](https://emscripten.org/docs/api_reference/preamble.js.html) for additional information.
 * @namespace WrenJS
 */
WrenJS._listeners = {}
// Browser-esque listener implementation.
if (typeof window !== 'undefined') {
  WrenJS.on = WrenJS.addEventListener = function(t, cb) {
    if (!(t in WrenJS._listeners)) {
      WrenJS._listeners[t] = []
    }
    WrenJS._listeners[t].push(cb)
  }
  WrenJS.off = WrenJS.removeEventListener = function(t, cb) {
      if (!(t in WrenJS._listeners)) {
        return
      }
      var stack = WrenJS._listeners[t]
      for (var i = 0, l = stack.length; i < l; i++) {
        if (stack[i] === cb) {
          stack.splice(i, 1)
          return
        }
      }
  }
  WrenJS.emit = WrenJS.dispatchEvent = function(e) {
    if (!(e.type in WrenJS._listeners)) {
      return true
    }
    var stack = WrenJS._listeners[e.type].slice()

    for (var i = 0, l = stack.length; i < l; i++) {
      stack[i].call(WrenJS, e)
    }
    return !e.defaultPrevented
  }
  window.WrenJS = WrenJS
}

// Node-esque listener implementation.
if (typeof module !== 'undefined') {
  WrenJS.on = WrenJS.addListener = function(t, cb) {
    if (!(t in WrenJS._listeners)) {
      WrenJS._listeners[t] = []
    }
    WrenJS._listeners[t].push(cb)
  }
  WrenJS.off = WrenJS.removeListener = function(t, cb) {
    if (!(t in WrenJS._listeners)) {
      return
    }
    var stack = WrenJS._listeners[t]
    for (var i = 0, l = stack.length; i < l; i++) {
      if (stack[i] === cb) {
        stack.splice(i, 1)
        return
      }
    }
  }
  WrenJS.emit = function(t) {
    if (!(t in WrenJS._listeners)) {
      return true
    }
    var stack = WrenJS._listeners[t].slice()

    for (var i = 0, l = stack.length; i < l; i++) {
      stack[i].call(WrenJS, t)
    }
  }
  module.exports = WrenJS
}

WrenJS._VMs = {}
WrenJS._addVM = function(vm) {
  return WrenJS._VMs[vm.ID] = vm
}

WrenJS.freeVM = function(id) {
  if (WrenJS._VMs[id]) {
    WrenJS._freeWrenVM(id)
    delete WrenJS._VMs[id]
  }
}
WrenJS.getVM = function(id) {
  return WrenJS._VMs[id]
}

/**
 * Creates and returns a new WrenVM instance.
 * @param {object} config Provides a config object that can contain errorFn and/or writeFn.
 * @returns {WrenVM}
 * @memberof WrenJS
 */
WrenJS.newVM = function(config) {
  return WrenJS._addVM(new WrenVM(WrenJS._makeWrenVM(), config || {}))
}

// Let's add a listener for ready ourselves so we can get appropriate constants
WrenJS.on('ready', function() {
  // Get our WrenInterpretResults
  /**
   * WrenInterpretResult is the resulting value of a call to WrenVM.interpret.
   * @typedef {number} WrenInterpretResult
   * @property {number} [RESULT_COMPILE_ERROR] Compilation error.
   * @property {number} [RESULT_RUNTIME_ERROR] Runtime error.
   * @property {number} [RESULT_SUCCESS] Success.
   * @memberof WrenJS
   */
  WrenJS.RESULT_COMPILE_ERROR = WrenJS._getWrenResultCompileError()
  WrenJS.RESULT_RUNTIME_ERROR = WrenJS._getWrenResultRuntimeError()
  WrenJS.RESULT_SUCCESS       = WrenJS._getWrenResultSuccess()
  // Get our WrenTypes
  /**
   * WrenType represents a WrenVM data type.
   * @typedef {number} WrenType
   * @property {number} [TYPE_BOOL] Boolean type.
   * @property {number} [TYPE_NUM] Numerical type.
   * @property {number} [TYPE_STRING] String type.
   * @property {number} [TYPE_LIST] List type.
   * @property {number} [TYPE_FOREIGN] Foreign object type.
   * @property {number} [TYPE_NULL] Null type.
   * @property {number} [TYPE_UNKNOWN] Unknown type.
   * @memberof WrenJS
   */
  WrenJS.TYPE_BOOL            = WrenJS._getWrenTypeBool()
  WrenJS.TYPE_NUM             = WrenJS._getWrenTypeNum()
  WrenJS.TYPE_FOREIGN         = WrenJS._getWrenTypeForeign()
  WrenJS.TYPE_LIST            = WrenJS._getWrenTypeList()
  WrenJS.TYPE_NULL            = WrenJS._getWrenTypeNull()
  WrenJS.TYPE_STRING          = WrenJS._getWrenTypeString()
  WrenJS.TYPE_UNKNOWN         = WrenJS._getWrenTypeUnknown()
  /**
   * WrenErrorType represents a given error type that will be passed to
   * WrenVM.errorFn.
   * @typedef {number} WrenErrorType
   * @property {number} [ERROR_COMPILE] Compile-time error.
   * @property {number} [ERROR_RUNTIME] Run-time error.
   * @property {number} [ERROR_STACK_TRACE] Stack-trace for a given error.
   * @memberof WrenJS
   */
  WrenJS.ERROR_COMPILE        = WrenJS._getWrenErrorCompile()
  WrenJS.ERROR_RUNTIME        = WrenJS._getWrenErrorRuntime()
  WrenJS.ERROR_STACK_TRACE    = WrenJS._getWrenErrorStackTrace()
})
