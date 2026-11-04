# Native proxy integration check

These tests exercise the production `NouProxy.swift` with real `URLSession` and
`WKWebView` requests. A loopback fixture requires synthetic credentials and serves
an otherwise unresolvable hostname, so a direct connection cannot pass.

Start the fixture from the repository root in a separate terminal:

```sh
python3 tests/ios/proxy-fixture.py
```

For macOS 14 or later, build a small app bundle (the bundle supplies the test-only
HTTP transport exception):

```sh
mkdir -p /tmp/NouProxyTests.app/Contents/MacOS
xcrun swiftc modules/nou-tube-view/ios/NouProxy.swift tests/ios/ProxyIntegration.swift \
  -o /tmp/NouProxyTests.app/Contents/MacOS/NouProxyTests
cat > /tmp/NouProxyTests.app/Contents/Info.plist <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>org.noutube.proxy-tests</string>
<key>CFBundleExecutable</key><string>NouProxyTests</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>NSAppTransportSecurity</key><dict><key>NSAllowsArbitraryLoads</key><true/></dict>
</dict></plist>
PLIST
/tmp/NouProxyTests.app/Contents/MacOS/NouProxyTests
```

The same Swift source also contains an iOS app entry point. Compile it with the
iPhoneSimulator SDK and an `arm64-apple-ios17.0-simulator` target, package it in an
app bundle with the same transport exception, sign ad hoc, and install/launch via
`simctl`. Its Documents directory contains `result.txt` and `trace.txt`.

Coverage: authenticated HTTP CONNECT and SOCKS5 for both networking APIs, changed
wrong credentials, invalid endpoint rejection, and removal of proxy configuration
when disabled. WebKit applies changes asynchronously; the changed-credential test
waits one second before checking rejection on a new origin, which forces a fresh
tunnel. Existing authenticated connections can outlive a credential change.
iOS 16 legacy HTTP-feed behavior needs
an iOS 16 runtime to verify on-device.

Stop the fixture with Ctrl-C after testing. It binds only to localhost, but can
tunnel real destinations while running; never use it as a production proxy.
