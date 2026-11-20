#import <Python/Python.h>
#import "NouPythonDownload.h"

static void NouDownloadError(NSError **error, NSString *message) {
  if (error) {
    *error = [NSError errorWithDomain:@"NouTube.YtDlp" code:1
                             userInfo:@{NSLocalizedDescriptionKey: message}];
  }
}

static PyObject *NouPyProgressCallback(PyObject *self, PyObject *args) {
  double percent = 0;
  const char *line = "";
  if (!PyArg_ParseTuple(args, "ds", &percent, &line)) return NULL;
  NouDownloadProgressHandler handler = (__bridge NouDownloadProgressHandler)PyCapsule_GetPointer(self, "nou.progress");
  if (handler) {
    NSString *text = line ? @(line) : @"";
    handler(percent, text);
  }
  Py_RETURN_NONE;
}

static PyMethodDef NouPyProgressMethodDef = {
  "nou_progress", NouPyProgressCallback, METH_VARARGS, NULL
};

@implementation NouPythonDownload

+ (NSString *)downloadURL:(NSString *)url
                directory:(NSString *)directory
                    proxy:(nullable NSString *)proxy
                 progress:(nullable NouDownloadProgressHandler)progress
                    error:(NSError **)error {
  static dispatch_once_t once;
  static NSString *initializationError;
  dispatch_once(&once, ^{
    NSString *home = [NSBundle.mainBundle.bundlePath stringByAppendingPathComponent:@"python"];
    NSString *packages = [home stringByAppendingPathComponent:@"app_packages"];
    NSString *stdlib = [home stringByAppendingPathComponent:@"lib/python3.13"];
    NSString *dynload = [stdlib stringByAppendingPathComponent:@"lib-dynload"];

    PyConfig config;
    PyConfig_InitIsolatedConfig(&config);
    config.write_bytecode = 0;
    config.site_import = 0;
    config.module_search_paths_set = 1;
    PyStatus status = PyConfig_SetBytesString(&config, &config.home, home.fileSystemRepresentation);
    if (!PyStatus_Exception(status)) {
      // CPython's Apple framework loader resolves extension modules relative to this path.
      status = PyConfig_SetBytesString(&config, &config.executable,
                                      NSBundle.mainBundle.executablePath.fileSystemRepresentation);
    }
    for (NSString *path in @[stdlib, dynload, packages]) {
      if (PyStatus_Exception(status)) break;
      wchar_t *value = Py_DecodeLocale(path.fileSystemRepresentation, NULL);
      if (!value) {
        status = PyStatus_NoMemory();
        break;
      }
      status = PyWideStringList_Append(&config.module_search_paths, value);
      PyMem_RawFree(value);
    }
    if (!PyStatus_Exception(status)) status = Py_InitializeFromConfig(&config);
    if (PyStatus_Exception(status)) {
      initializationError = status.err_msg ? @(status.err_msg) : @"Couldn't initialize Python";
    } else {
      // Later requests may run on a different thread. Release the initial GIL.
      PyEval_SaveThread();
    }
    PyConfig_Clear(&config);
  });
  if (initializationError) {
    NouDownloadError(error, initializationError);
    return nil;
  }

  PyGILState_STATE gil = PyGILState_Ensure();
  PyObject *module = PyImport_ImportModule("nou_download");
  PyObject *function = module ? PyObject_GetAttrString(module, "download") : NULL;
  PyObject *capsule = progress ? PyCapsule_New((__bridge void *)progress, "nou.progress", NULL) : NULL;
  PyObject *callback = capsule ? PyCFunction_New(&NouPyProgressMethodDef, capsule) : NULL;
  PyObject *result = function
    ? PyObject_CallFunction(function, "sszO", url.UTF8String, directory.UTF8String,
                            proxy ? proxy.UTF8String : NULL, callback ? callback : Py_None)
    : NULL;
  const char *path = result ? PyUnicode_AsUTF8(result) : NULL;
  NSString *filePath = path ? @(path) : nil;
  if (!filePath) {
    PyObject *exception = PyErr_GetRaisedException();
    PyObject *text = exception ? PyObject_Str(exception) : NULL;
    const char *message = text ? PyUnicode_AsUTF8(text) : NULL;
    NouDownloadError(error, message ? @(message) : @"yt-dlp failed");
    Py_XDECREF(text);
    Py_XDECREF(exception);
    PyErr_Clear();
  }
  Py_XDECREF(result);
  Py_XDECREF(callback);
  Py_XDECREF(capsule);
  Py_XDECREF(function);
  Py_XDECREF(module);
  PyGILState_Release(gil);
  return filePath;
}

@end
