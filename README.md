# WrenJS+
WrenJS+ is an emscripten "port" of the [Wren Virtual Machine](https://wren.io) to JavaScript. It implements, through its own wrapper, the full Wren API, including **foreign methods**, **foreign classes**, and **imports**.

It attempts to provide as vanilla of a Wren experience as possible, but with the exception of representing individual virtual machines as objects.

A basic example of interpreting a Wren script would be:

```
// Ensure that WrenJS+ has loaded successfully.
WrenJS.on('ready', () => {

  // Create our WrenVM instance.
  let vm = WrenJS.newVM({
    writeFn: console.log,
    errorFn: console.error,
  })
  
  // Interpret a small script and handle the result.
  vm.interpret("main", 'System.print("Hello xorld!")').then(result => {
  
    if (result == WrenJS.RESULT_COMPILE_ERROR) {
      console.error("Compilation error!")
    } else if (result == WrenJS.RESULT_RUNTIME_ERROR) {
      console.error("Runtime error!")
    } else if (result == WrenJS.RESULT_SUCCESS) {
      console.log("Success!")
    }
    
    // Finally free the VM's resources.
    vm.free()
  })
  
})
```

Of course, we can do much more than this, whether using `vm.call(handle)` to run a main loop or shuttling data between Wren and JavaScript via the various setters and getters provided by WrenJS+. Please read the API documentation [here](docs/API.md) or explore the [examples](https://kettek.github.io/wrenjs-plus/examples/).

## Installation
There are multiple ways to acquire WrenJS+.

The first, and simplest, is to use a content delivery network:

```
<script src="https://cdn.jsdelivr.net/gh/kettek/wrenjs-plus@v1.0.0/dist/WrenJS+.js"></script>
```

The second is to download and use a [release provided on WrenJS+'s GitHub page](https://github.com/kettek/wrenjs-plus/releases).

The third is to pull this repository and compile `WrenJS+.js` yourself. This method is presented under [Compilation](#compilation).

## Usage
To use WrenJS+, you must supply a `ready` event listener to the WrenJS object. After this ready event is handled, you are free to use any of the [WrenJS and WrenVM APIs](docs/API.md).

### Browser Example
```
<script src="dist/WrenJS+.js"></script>
<script>
WrenJS.on("ready", () => {
  // Use WrenJS APIs
})
</script>

```

### NodeJS Example
```
const WrenJS = require('./dist/WrenJS+.js')

WrenJS.on("ready", () => {
  // Use WrenJS APIs
})
```

### Browser and Node environment differences
When running under Node, WrenJS+ is exported as a require-able module and also provides Node-style event methods.

| Browser | Node |
|-|-|
| `on(name, cb)` *or* `addEventListener(name, cb)` | `on(name, cb)` *or* `addListener(name, cb)`
| `off(name, cb)` *or* `removeEventListener(name, cb)` | `off(name, cb)` *or* `removeListener(name, cb)`
| `emit(event)` *or* `dispatchEvent(event)` | `emit(name)`

### Import Methods
Wren files can be imported, if desired, through a couple ways.

#### VM-specific importing
With default builds, Wren files can be imported relative to a specific VM instance by using the [importFile](https://github.com/kettek/wrenjs-plus/blob/master/docs/API.md#importfile) or [importFiles](https://github.com/kettek/wrenjs-plus/blob/master/docs/API.md#importfiles) methods. These simply use XHR in the browser to load all the files into strings that are stored on the VM instance itself.

#### Fetching
Wren files can also be imported by providing a properly annotated `script` tag and calling the standard Wren `import "myModule" for myClass` syntax. The annotation is: `<script type="text/wren" src="..."></script>`.

If desired, Wren can be built without a `script` tag requirement, allowing it to request arbitrary files on the hosting web server. See the [ALLOW_NONSCRIPT_FETCH flag](#compilation-flags) for more information.

## Compilation
WrenJS+ uses a [premake5](https://premake.github.io/) configuration file for managing its compilation and, as such, you must have it available in your PATH. If you wish to edit the `premake5.lua` file, you will find the important parts are commented.

It is assumed that you have an emsdk build set up and have the `emmake` and `emcc` binaries in your PATH. If you do not have emsdk set up, please follow the official instructions [here](https://emscripten.org/docs/getting_started/downloads.html#installation-instructions).

### Building
Providing premake5 and emsdk are setup properly, building is extremely easy:

```
# cd src
# git clone https://github.com/wren-lang/wren.git
...
# cd ..
# premake5 gmake
...
# emmake make
...
```

This will compile the debug release per default. If you wish to compile a release, set the `config` environment variable to "release" prior to running `emmake make`. For example, under fish: `env config="release" emmake make`.

Providing the above commands worked without issue (and if they did not, please report it), you will have built and ready to use `WrenJS+.js` and `WrenJS+.wasm` files in the `dist/` directory.

### Compilation flags
WrenJS+ can have the following flags passed to it during building to restrict or implement particular features. Per default none of these are used.

| flag                     | Description | Default
|-|-|-|
| `DISABLE_JSVM_IMPORT`    | Disables the use of Wren imports provided by `vm.importFile(...)` or `vm.importFiles([...])`.
| `DISABLE_FETCH_IMPORT`   | Disables emscripten's XHR fetching for acquiring Wren imports.
| `ALLOW_NONSCRIPT_FETCH`  | Allows XHR fetching for any file path. Otherwise XHR fetching is limited to scripts appearing in the document head that adhere to the following format: `<script type="text/wren" src="..."></script>`

You can add any of these flags as `DEFINES` provided to `emmake` as such: `emmake make DEFINES="-DALLOW_NONSCRIPT_FETCH"`.

Note that if you wish to not use fetching at all, it is recommended that you remove the following emscripten flags from the `premake5.lua` script before building:

  * `FETCH=1`
  * `EMTERPRETIFY=1`
  * `EMTERPRETIFY_ASYNC=1`
    
Removing these will allow emscripten to run asynchronously which should be faster.

### Node Compilation
To compile for Node you must disable XHR fetching as emscripten's fetch system does not support the Node environment.

### Building for file://
To build for local file access, you must disable the use of WASM by adding `WASM=0` to the emscripten_flags list in the premake5.lua script and build using the debug config. e.g., `env config="debug" emmake make`.