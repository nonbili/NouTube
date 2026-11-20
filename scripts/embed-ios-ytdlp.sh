#!/bin/bash
set -eo pipefail

module=../modules/nou-tube-view/ios
framework="$module/vendor/Python.xcframework"
test -d "$PROJECT_DIR/$framework" || { echo 'error: Run bash scripts/prepare-ios-ytdlp.sh'; exit 1; }

# BeeWare expects ARCHS to be a single architecture. Since the .so files
# are per-architecture, resolve a single simulator architecture and fail if ambiguous.
if [ "$EFFECTIVE_PLATFORM_NAME" = '-iphonesimulator' ]; then
  if [ -n "${CURRENT_ARCH:-}" ] && [ "$CURRENT_ARCH" != 'undefined_arch' ]; then
    ARCHS=$CURRENT_ARCH
  elif [ "$ARCHS" = 'arm64' ] || [ "$ARCHS" = 'x86_64' ]; then
    :
  elif [ -n "${NATIVE_ARCH_ACTUAL:-}" ] && [ "$NATIVE_ARCH_ACTUAL" != 'undefined_arch' ]; then
    ARCHS=$NATIVE_ARCH_ACTUAL
  else
    echo "error: Ambiguous simulator architecture (ARCHS='$ARCHS', CURRENT_ARCH='${CURRENT_ARCH:-}')" >&2
    exit 1
  fi
fi
if [ -z "${EXPANDED_CODE_SIGN_IDENTITY:-}" ]; then EXPANDED_CODE_SIGN_IDENTITY=-; fi

source "$PROJECT_DIR/$framework/build/utils.sh"
install_python "$framework"
mkdir -p "$CODESIGNING_FOLDER_PATH/python/app_packages"
rsync -a --delete "$PROJECT_DIR/$module/vendor/app_packages/" "$CODESIGNING_FOLDER_PATH/python/app_packages/"
cp "$PROJECT_DIR/$module/ytdlp/nou_download.py" "$CODESIGNING_FOLDER_PATH/python/app_packages/"
