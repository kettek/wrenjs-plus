# WrenJS+
WrenJS+ is an emscripten "port" of the [Wren Virtual Machine](https://wren.io) to JavaScript. It implements, through its own wrapper, the full Wren API, including **foreign methods**, **foreign classes**, and **imports**.

It attempts to provide as vanilla of a Wren experience as possible, but with the exception of representing individual virtual machines as objects.

A basic example of interpreting a Wren script would be:

```
// Ensure that WrenJS+ has loaded successfully.
WrenJS.addEventListener('ready', () => {

  // Create our WrenVM instance.
  let vm = WrenJS.newVM({
    writeFn: console.log,
    errorFn: console.error,
  })
  
  // Interpret a small script and handle the result.
  vm.interpret("main", 'System.print("Hello xorld!"').then(result => {
  
    if (result == WrenJS.RESULT_COMPILE_ERROR) {
      console.log("Compilation error!")
    } else if (result == WrenJS.RESULT_RUNTIME_ERROR) {
      console.log("Runtime error!")
    } else if (result == WrenJS.RESULT_SUCCESS) {
      console.log("Success!")
    }
    
    // Finally free the VM's resources.
    vm.free()
  })
  
})
```

Of course, we can do much more than this, whether using `call` to run a main loop or shuttling data between Wren and JavaScript via the various setters and getters provided by WrenJS+. Please read the API [here](TODO) and/or play with the examples [here](TODO).

## Installation
There are multiple ways to acquire WrenJS+.

The first, and simplest, is to use a content delivery network:

```
PUT CDN SCRIPT TAG HERE
```

The second is to download and use a [release provided on WrenJS+'s GitHub page](releases/).

The third is to pull this repository and compile `WrenJS+.js` yourself. This method is presented below.

## Compilation
WrenJS+ uses a [premake5](https://premake.github.io/) configuration file for managing its compilation and, as such, you must have it available in your PATH. If you wish to edit the `premake5.lua` file, you will find the important parts are commented.

It is assumed that you have an emsdk build set up and have the `emmake` and `emcc` binaries in your PATH. If you do not have emsdk set up, please follow the official instructions [here](https://emscripten.org/docs/getting_started/downloads.html#installation-instructions).

### Building
Providing premake5 and emsdk are setup properly, building is extremely easy:

```
# cd src
# git pull https://github.com/wren-lang/wren.git
...
# cd ..
# premake5 gmake
...
# emmake make
...
```

Providing the above commands worked without issue (and if they did not, please report it), you will have a built and ready to use `WrenJS+.js` file in the `dist/` directory.

### Compilation flags
WrenJS+ can have the following flags passed to it during building to restrict or implement particular features.

| flag                     | Description
|-|-|
| `IMPORT_FROM_JSVM`       | Enables calling `vm.importFile(...)` or `vm.importFiles([...])` to provide Wren imports.
| `IMPORT_FROM_FETCH`      | Enables emscripten to use XHR fetching to acquire Wren imports.
| `LIMIT_FETCH_TO_SCRIPTS` | Limits XHR fetching to only scripts appearing in the document head that adhere to the following format: `<script type="text/wren" src="..."></script>`

You can add any of these flags as `DEFINES` provided to `emmake` as such: `emmake make DEFINES="-DLIMIT_FETCH_TO_SCRIPTS"`.

Note that if you wish to not use fetching at all, it is recommended that you remove the following emscripten flags from `premake5.lua` script before building:

  * `FETCH=1`
  * `EMTERPRETIFY=1`
  * `EMTERPRETIFY_ASYNC=1`
    
Removing these will allow emscripten to run asynchronously which should be faster.

### Node Compilation
To compile for Node you must disable XHR fetching as emscripten's fetch system does not support the Node environment.