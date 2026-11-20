#!/bin/bash
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
vendor="$root/modules/nou-tube-view/ios/vendor"
mkdir -p "$vendor"
stage=$(mktemp -d "$vendor/.prepare.XXXXXX")
trap 'rm -rf "$stage"' EXIT

fetch() {
  curl --fail --silent --show-error --location --retry 2 "$1" -o "$stage/$2"
  printf '%s  %s\n' "$3" "$stage/$2" | shasum -a 256 -c -
}

fetch https://github.com/beeware/Python-Apple-support/releases/download/3.13-b18/Python-3.13-iOS-support.b18.tar.gz python.tar.gz d06acf2a9c7964a8689566353a0e707402eff822037de5e29ba0e16040f7047d
fetch https://files.pythonhosted.org/packages/7f/3d/16ea7d5638cf585991f2c5705e8083688dde633d32d0871f2404e0f4d827/yt_dlp-2026.10.26-py3-none-any.whl yt-dlp.whl a05c5b5d8562f7e8a62f5334348b406af4930d56d3a65f8021d14af0e22339ae
fetch https://files.pythonhosted.org/packages/32/d1/a3652fe2c19134d0d15922177821d863cbd7e842d53a21bbe7e8e3a1b5ac/certifi-2026.10.23-py3-none-any.whl certifi.whl e9b54de76e530bb6cf0ccd036787103acb58fd42ba930ea8bf948ddbaa2f61d1

tar -xzf "$stage/python.tar.gz" -C "$stage" Python.xcframework
unzip -q "$stage/yt-dlp.whl" -d "$stage/app_packages"
unzip -q "$stage/certifi.whl" -d "$stage/app_packages"
rsync -a --delete "$stage/Python.xcframework/" "$vendor/Python.xcframework/"
rsync -a --delete "$stage/app_packages/" "$vendor/app_packages/"
