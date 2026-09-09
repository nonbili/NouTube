import Foundation
import MediaPlayer
import AVFoundation
import UIKit

// The lock screen and Control Center controls. Only one view drives them at a
// time: the split watch layout keeps two views alive and JS says which of them
// holds the video (claimMediaSession).
final class NouNowPlaying {
  static let shared = NouNowPlaying()

  private weak var owner: NouTubeView?
  private var commandsInstalled = false
  private var sessionConfigured = false
  private var title = ""
  private var author = ""
  private var duration: Double = 0
  private var thumbnailUrl = ""
  private var artworkTask: URLSessionDataTask?

  func claim(_ view: NouTubeView) {
    owner = view
  }

  func pause() {
    _ = run("NouTube.pause()")
  }

  // Configured once and left alone. Re-issuing setActive(true) while WebKit is
  // already playing reads as an activation request against its own session and
  // pauses the video, and notifyProgress arrives about once a second -- so this
  // has to stay idempotent no matter how often it is called.
  func activateAudioSession() {
    guard !sessionConfigured else { return }
    sessionConfigured = true

    let session = AVAudioSession.sharedInstance()
    try? session.setCategory(.playback, mode: .moviePlayback)
    try? session.setActive(true)

    // A call or another app taking the audio deactivates our session; without
    // reclaiming it here playback stays silent for the rest of the session.
    NotificationCenter.default.addObserver(
      forName: AVAudioSession.interruptionNotification,
      object: session,
      queue: .main
    ) { note in
      guard
        let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
        AVAudioSession.InterruptionType(rawValue: raw) == .ended
      else {
        return
      }
      try? session.setActive(true)
    }
  }

  func update(view: NouTubeView, title: String, author: String, seconds: Double, thumbnail: String) {
    // Whoever is playing owns the controls unless another view has claimed them.
    if owner == nil { owner = view }
    guard owner === view else { return }

    installCommands()
    self.title = title
    self.author = author
    self.duration = seconds
    var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
    info[MPMediaItemPropertyTitle] = title
    info[MPMediaItemPropertyArtist] = author
    info[MPMediaItemPropertyPlaybackDuration] = seconds
    MPNowPlayingInfoCenter.default().nowPlayingInfo = info

    if thumbnail != thumbnailUrl {
      thumbnailUrl = thumbnail
      loadArtwork(thumbnail)
    }
  }

  func updateProgress(view: NouTubeView, playing: Bool, position: Double) {
    if owner == nil { owner = view }
    guard owner === view else { return }

    installCommands()
    var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
    info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = position
    info[MPNowPlayingInfoPropertyPlaybackRate] = playing ? 1.0 : 0.0
    MPNowPlayingInfoCenter.default().nowPlayingInfo = info
  }

  private func loadArtwork(_ urlString: String) {
    artworkTask?.cancel()
    guard let url = URL(string: urlString) else { return }
    artworkTask = URLSession.shared.dataTask(with: url) { data, _, _ in
      guard let data, let image = UIImage(data: data) else { return }
      DispatchQueue.main.async {
        // A newer video may have landed while this download was in flight.
        guard urlString == self.thumbnailUrl else { return }
        var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
        info[MPMediaItemPropertyArtwork] = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
      }
    }
    artworkTask?.resume()
  }

  private func run(_ script: String) -> MPRemoteCommandHandlerStatus {
    guard let owner else { return .noSuchContent }
    DispatchQueue.main.async {
      owner.webView.evaluateJavaScript(script, completionHandler: nil)
    }
    return .success
  }

  private func installCommands() {
    guard !commandsInstalled else { return }
    commandsInstalled = true
    activateAudioSession()

    let center = MPRemoteCommandCenter.shared()
    center.playCommand.addTarget { [weak self] _ in self?.run("NouTube.play()") ?? .noSuchContent }
    center.pauseCommand.addTarget { [weak self] _ in self?.run("NouTube.pause()") ?? .noSuchContent }
    center.togglePlayPauseCommand.addTarget { [weak self] _ in
      self?.run("NouTube.getPlaying?.() ? NouTube.pause() : NouTube.play()") ?? .noSuchContent
    }
    center.nextTrackCommand.addTarget { [weak self] _ in self?.run("NouTube.next()") ?? .noSuchContent }
    center.previousTrackCommand.addTarget { [weak self] _ in self?.run("NouTube.prev()") ?? .noSuchContent }
    center.skipBackwardCommand.preferredIntervals = [10]
    center.skipBackwardCommand.addTarget { [weak self] _ in self?.run("NouTube.seekBy(-10)") ?? .noSuchContent }
    center.skipForwardCommand.preferredIntervals = [30]
    center.skipForwardCommand.addTarget { [weak self] _ in self?.run("NouTube.seekBy(30)") ?? .noSuchContent }
    center.changePlaybackPositionCommand.addTarget { [weak self] event in
      guard let event = event as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }
      return self?.run("NouTube.seekTo(\(event.positionTime))") ?? .noSuchContent
    }
  }
}
