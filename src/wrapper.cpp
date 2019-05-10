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
#include "wren.hpp"
#include <memory.h>
#include <stdio.h>
#include <string.h>
#include <emscripten.h>
#include <emscripten/fetch.h>

#if !defined(DISABLE_FETCH_IMPORT) || !defined(DISABLE_JSVM_IMPORT)
#define CAN_IMPORT
#else
#warning "No module importing method enabled. Wren imports will be nonfunctional."
#endif

// See WrenJS.js for the definitions of the following functions.
extern "C" {
  extern void WrenJS_writeFn(WrenVM*, const char*);
  extern void WrenJS_errorFn(WrenVM*, int, const char*, int, const char*);
  extern WrenForeignMethodFn WrenJS_getForeignMethod(WrenVM*, const char*, const char*, bool, const char*);
  extern WrenForeignMethodFn WrenJS_getForeignClassAllocator(WrenVM*, const char*, const char*);
  extern WrenFinalizerFn WrenJS_getForeignClassFinalizer(WrenVM*, const char*, const char*);
#if !defined(ALLOW_NONSCRIPT_FETCH)
  extern bool WrenJS_isFileAvailable(const char *);
#endif
#if !defined(DISABLE_JSVM_IMPORT)
  extern void WrenJS_importFileFromVM(WrenVM*, const char *, char**, int*);
#endif
}

#if !defined(DISABLE_FETCH_IMPORT)

short fetchLock = 0;
short fetchSuccess = 0;
void downloadSucceeded(emscripten_fetch_t *fetch) {
  fetchLock = 0;
  fetchSuccess = 1;
}

void downloadFailed(emscripten_fetch_t *fetch) {
  fetchLock = 0;
  fetchSuccess = 0;
}

void getFile(const char *filename, char **recv, int *bytes) {
  emscripten_fetch_t *fetch;
  emscripten_fetch_attr_t attr;

  emscripten_fetch_attr_init(&attr);
  strcpy(attr.requestMethod, "GET");
  attr.attributes = EMSCRIPTEN_FETCH_LOAD_TO_MEMORY;
  attr.onsuccess = downloadSucceeded;
  attr.onerror = downloadFailed;

  fetchLock = 1;
  fetch = emscripten_fetch(&attr, filename);
  while (fetchLock) emscripten_sleep(10);
  if (fetchSuccess) {
    *recv = (char*)malloc(sizeof(char) * fetch->numBytes);
    memcpy(*recv, (char*)fetch->data, fetch->numBytes);
    *bytes = fetch->numBytes;
    (*recv)[*bytes-1] = '\0';
  } else {
    *recv = NULL;
    *bytes = -1;
  }
  emscripten_fetch_close(fetch);
}

#endif

#ifdef CAN_IMPORT
char* loadModuleFn(WrenVM* vm, const char* name) {
  char *data = NULL;
  int bytes;

  int fullSize = strlen(name) + strlen(".wren") + 1;
  char *fullName = (char*)malloc(fullSize);
  memcpy(fullName, name, strlen(name));
  memcpy(fullName+strlen(name), ".wren", strlen(".wren"));
  fullName[fullSize-1] = '\0';

  #if !defined(DISABLE_JVM_IMPORT)
  WrenJS_importFileFromVM(vm, fullName, &data, &bytes);
  if (data != NULL && bytes > 0) {
    free(fullName);
    return data;
  }
  #endif
  #if !defined(DISABLE_FETCH_IMPORT)
  #if !defined(ALLOW_NONSCRIPT_FETCH)
  if (!WrenJS_isFileAvailable(fullName)) {
    free(fullName);
    return data;
  }
  #endif
  getFile(fullName, &data, &bytes);
  #endif

  free(fullName);

  return data;
}
#endif

void errorFn(WrenVM* vm, WrenErrorType type, const char* module, int line, const char* message) {
  WrenJS_errorFn(vm, type, module, line, message);
}

void writeFn(WrenVM* vm, const char* text) {
  WrenJS_writeFn(vm, text);
}

WrenForeignMethodFn bindForeignMethodFn(WrenVM* vm, const char* module, const char* className, bool isStatic, const char* signature) {
  return WrenJS_getForeignMethod(vm, module, className, isStatic, signature);
}

WrenForeignClassMethods bindForeignClassFn(WrenVM* vm, const char* module, const char* className) {
  WrenForeignClassMethods classMethods = {
    WrenJS_getForeignClassAllocator(vm, module, className),
    WrenJS_getForeignClassFinalizer(vm, module, className),
  };
  return classMethods;
}

extern "C" {

WrenInterpretResult EMSCRIPTEN_KEEPALIVE interpretWrenVM(WrenVM* vm, const char* module, const char* source) {
  return wrenInterpret(vm, module, source);
}

int EMSCRIPTEN_KEEPALIVE makeWrenVM() {
  WrenConfiguration config;
  wrenInitConfiguration(&config);

  config.writeFn = writeFn;
  config.errorFn = errorFn;
#ifdef CAN_IMPORT
  config.loadModuleFn = loadModuleFn;
#endif
  config.bindForeignMethodFn = bindForeignMethodFn;
  config.bindForeignClassFn  = bindForeignClassFn;

  WrenVM* vm = wrenNewVM(&config);

  return (int)vm;
}

void EMSCRIPTEN_KEEPALIVE freeWrenVM(WrenVM* vm) {
  if (vm == NULL) return;
  wrenFreeVM(vm);
}

// Helper functions to acquire Wren Constants
int EMSCRIPTEN_KEEPALIVE getWrenResultCompileError() {
  return WREN_RESULT_COMPILE_ERROR;
}
int EMSCRIPTEN_KEEPALIVE getWrenResultRuntimeError() {
  return WREN_RESULT_RUNTIME_ERROR;
}
int EMSCRIPTEN_KEEPALIVE getWrenResultSuccess() {
  return WREN_RESULT_SUCCESS;
}
int EMSCRIPTEN_KEEPALIVE getWrenTypeBool() {
  return WREN_TYPE_BOOL;
}
int EMSCRIPTEN_KEEPALIVE getWrenTypeNum() {
  return WREN_TYPE_NUM;
}
int EMSCRIPTEN_KEEPALIVE getWrenTypeForeign() {
  return WREN_TYPE_FOREIGN;
}
int EMSCRIPTEN_KEEPALIVE getWrenTypeList() {
  return WREN_TYPE_LIST;
}
int EMSCRIPTEN_KEEPALIVE getWrenTypeNull() {
  return WREN_TYPE_NULL;
}
int EMSCRIPTEN_KEEPALIVE getWrenTypeString() {
  return WREN_TYPE_STRING;
}
int EMSCRIPTEN_KEEPALIVE getWrenTypeUnknown() {
  return WREN_TYPE_UNKNOWN;
}
int EMSCRIPTEN_KEEPALIVE getWrenErrorCompile() {
  return WREN_ERROR_COMPILE;
}
int EMSCRIPTEN_KEEPALIVE getWrenErrorRuntime() {
  return WREN_ERROR_RUNTIME;
}
int EMSCRIPTEN_KEEPALIVE getWrenErrorStackTrace() {
  return WREN_ERROR_STACK_TRACE;
}

}
