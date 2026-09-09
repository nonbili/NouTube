import ExpoModulesCore

struct NouSettings: Record {
  @Field var proxyEnabled: Bool = false
  @Field var proxyType: String = "http"
  @Field var proxyHost: String = ""
  @Field var proxyPort: String = ""
  @Field var showMediaNotificationPrevButton: Bool = true
  @Field var showMediaNotificationNextButton: Bool = true
  @Field var showMediaNotificationRewindButton: Bool = true
  @Field var showMediaNotificationForwardButton: Bool = true
  @Field var showMediaNotificationSpeedButton: Bool = true
  @Field var showMediaNotificationCloseButton: Bool = true
  @Field var playbackRate: Double = 1
  @Field var blockAds: Bool = false
}
