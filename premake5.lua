--
workspace "WrenJS+"
  configurations { "Debug", "Release" }

project "WrenJS+"
  targetname ("WrenJS+")
  targetextension (".bc")
  kind "ConsoleApp"
  language "c++"
  cppdialect "C++11"
  toolset ("clang")

  files { "src/*.cpp" }
  files { "src/wren/src/vm/*", "src/wren/src/optional/*" }
  includedirs { "src", "src/wren/src/**" }

  defines { "WREN_OPT_RANDOM" }
  defines { "IMPORT_FROM_JSVM", "IMPORT_FROM_FETCH", "LIMIT_FETCH_TO_SCRIPTS" }

  -- Runtime methods to export to the emscripten module.
  runtime_methods = {'cwrap', 'addFunction'}
  -- Functions to export to the emscripten module.
  exported_functions = {
    -- interpret calls
    '_wrenInterpret',
    '_wrenCall',
    -- Slot access
    '_wrenEnsureSlots',
    '_wrenGetSlotCount',
    '_wrenGetSlotType',
    '_wrenSetSlotBool',
    '_wrenGetSlotBool',
    '_wrenSetSlotDouble',
    '_wrenGetSlotDouble',
    '_wrenSetSlotString',
    '_wrenGetSlotString',
    '_wrenSetSlotBytes',
    '_wrenGetSlotBytes',
    '_wrenSetSlotNull',
    '_wrenGetVariable',
    '_wrenSetSlotNewList',
    '_wrenGetListCount',
    '_wrenGetListElement',
    '_wrenInsertInList',
    '_wrenSetSlotHandle',
    '_wrenGetSlotHandle',
    '_wrenSetSlotNewForeign',
    '_wrenGetSlotForeign',
    -- Handle management
    '_wrenMakeCallHandle',
    '_wrenReleaseHandle',
    -- Other
    '_wrenCollectGarbage',
    '_wrenAbortFiber',
  }
  -- The amount of function pointers to reserve. Used for Foreign methods and classes.
  reserved_function_pointers = 1000
  -- These are the flags to pass to emcc.
  emscripten_flags = {
    'FETCH=1',
    'EMTERPRETIFY=1',
    'EMTERPRETIFY_ASYNC=1',
    [[EXTRA_EXPORTED_RUNTIME_METHODS="[']] .. table.concat(runtime_methods, "','") .. [[']"]],
    [[EXPORTED_FUNCTIONS="[']] .. table.concat(exported_functions, "','") .. [[']"]],
    'RESERVED_FUNCTION_POINTERS=' .. reserved_function_pointers
  }

  postbuildcommands { "{MKDIR} dist", [[emcc -s ]] .. table.concat(emscripten_flags, " -s ") .. [[ --pre-js %{cfg.basedir}/js/WrenJS-pre.js --post-js %{cfg.basedir}/js/WrenJS-post.js --js-library %{cfg.basedir}/js/WrenJS.js bin/%{cfg.buildcfg}/%{cfg.targetname}%{cfg.targetextension} -o %{cfg.basedir}/dist/%{cfg.targetname}.js]] }

  filter "configurations:Debug"
    defines { "DEBUG" }
    symbols "On"

  filter "configurations:Release"
    defines { "NDEBUG" }
    optimize "On"

