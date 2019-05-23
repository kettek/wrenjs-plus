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

WrenJS.noInitialRun = true

/**
 * WrenJS is the interface through which Wren VMs are created. Be aware that this is actually an Emscripten Module.
 * See [preamble.js](https://emscripten.org/docs/api_reference/preamble.js.html) for additional information.
 * @namespace WrenJS
 */
WrenJS._listeners = {}
WrenJS._hasReadied = false
// Browser-esque listener implementation.
if (typeof window !== 'undefined') {
  WrenJS.on = WrenJS.addEventListener = function(t, cb) {
    if (!(t in WrenJS._listeners)) {
      WrenJS._listeners[t] = []
    }
    // If the event listener is for ready and we have already readied, immediate cb
    if (t == 'ready' && WrenJS._hasReadied) {
      cb()
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
    // If the event listener is for ready and we have already readied, immediate cb
    if (t == 'ready' && WrenJS._hasReadied) {
      cb()
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

WrenJS.postRun = function() {
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

  WrenJS._hasReadied = true

  if (WrenJS.dispatchEvent) {
    WrenJS.dispatchEvent(new CustomEvent("ready"));
  } else if (WrenJS.emit) {
    WrenJS.emit("ready")
  }
}
