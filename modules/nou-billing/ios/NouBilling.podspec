Pod::Spec.new do |s|
  s.name           = 'NouBilling'
  s.version        = '1.0.0'
  s.summary        = 'StoreKit purchases for NouTube Sync.'
  s.description    = 'StoreKit purchases for NouTube Sync.'
  s.author         = 'Nonbili'
  s.homepage       = 'https://github.com/rnons/noutube'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
