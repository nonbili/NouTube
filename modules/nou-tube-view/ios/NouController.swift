import AVFoundation
import Foundation
import MediaPlayer
import UIKit

typealias LogFn = (String) -> Void
typealias CommandFn = (String) -> Void

class NouController {
  static let shared = NouController()

  var logFn: LogFn?
  var commandFn: CommandFn?

  private var playbackSessionConfigured = false
  private var playbackSessionActive = false
  private var remoteCommandsConfigured = false
  private var nowPlayingInfo: [String: Any] = [:]

  func log(_ msg: String) {
    logFn?(msg)
  }

  func preparePlaybackSession() {
    DispatchQueue.main.async {
      self.configurePlaybackSessionIfNeeded()
    }
  }

  func updatePlaybackSession(active: Bool) {
    DispatchQueue.main.async {
      self.configurePlaybackSessionIfNeeded()

      guard self.playbackSessionActive != active else { return }
      do {
        let options: AVAudioSession.SetActiveOptions = active ? [] : [.notifyOthersOnDeactivation]
        try AVAudioSession.sharedInstance().setActive(active, options: options)
        self.playbackSessionActive = active
      } catch {
        self.log("audio session activation failed: \(error.localizedDescription)")
      }
    }
  }

  func exit() {
    updatePlaybackSession(active: false)
    clearNowPlaying()

    // iOS apps generally don't "exit" themselves, but we can provide the interface.
    log("exit called")
  }

  func updateNowPlaying(title: String, author: String, duration: Int64) {
    DispatchQueue.main.async {
      self.nowPlayingInfo[MPMediaItemPropertyTitle] = title
      self.nowPlayingInfo[MPMediaItemPropertyArtist] = author
      self.nowPlayingInfo[MPMediaItemPropertyPlaybackDuration] = NSNumber(value: duration)
      MPNowPlayingInfoCenter.default().nowPlayingInfo = self.nowPlayingInfo
    }
  }

  func updatePlaybackProgress(playing: Bool, position: Double) {
    DispatchQueue.main.async {
      self.nowPlayingInfo[MPNowPlayingInfoPropertyElapsedPlaybackTime] = NSNumber(value: position)
      self.nowPlayingInfo[MPNowPlayingInfoPropertyPlaybackRate] = NSNumber(value: playing ? 1 : 0)
      MPNowPlayingInfoCenter.default().nowPlayingInfo = self.nowPlayingInfo
      if #available(iOS 13.0, *) {
        MPNowPlayingInfoCenter.default().playbackState = playing ? .playing : .paused
      }
    }
  }

  func clearNowPlaying() {
    DispatchQueue.main.async {
      self.nowPlayingInfo = [:]
      MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
      if #available(iOS 13.0, *) {
        MPNowPlayingInfoCenter.default().playbackState = .stopped
      }
    }
  }

  private func configurePlaybackSessionIfNeeded() {
    guard !playbackSessionConfigured else { return }

    do {
      try AVAudioSession.sharedInstance().setCategory(.playback, mode: .moviePlayback, options: [.allowAirPlay])
      UIApplication.shared.beginReceivingRemoteControlEvents()
      configureRemoteCommandsIfNeeded()
      playbackSessionConfigured = true
    } catch {
      log("audio session category failed: \(error.localizedDescription)")
    }
  }

  private func configureRemoteCommandsIfNeeded() {
    guard !remoteCommandsConfigured else { return }

    let center = MPRemoteCommandCenter.shared()
    center.playCommand.isEnabled = true
    center.pauseCommand.isEnabled = true
    center.nextTrackCommand.isEnabled = true
    center.previousTrackCommand.isEnabled = true
    center.skipForwardCommand.isEnabled = true
    center.skipBackwardCommand.isEnabled = true
    center.skipForwardCommand.preferredIntervals = [30]
    center.skipBackwardCommand.preferredIntervals = [10]

    center.playCommand.addTarget { [weak self] _ in
      self?.commandFn?("window.NouTube?.play?.()")
      return .success
    }
    center.pauseCommand.addTarget { [weak self] _ in
      self?.commandFn?("window.NouTube?.pause?.()")
      return .success
    }
    center.nextTrackCommand.addTarget { [weak self] _ in
      self?.commandFn?("window.NouTube?.next?.()")
      return .success
    }
    center.previousTrackCommand.addTarget { [weak self] _ in
      self?.commandFn?("window.NouTube?.prev?.()")
      return .success
    }
    center.skipForwardCommand.addTarget { [weak self] _ in
      self?.commandFn?("window.NouTube?.seekBy?.(30)")
      return .success
    }
    center.skipBackwardCommand.addTarget { [weak self] _ in
      self?.commandFn?("window.NouTube?.seekBy?.(-10)")
      return .success
    }

    remoteCommandsConfigured = true
  }
}

let nouController = NouController.shared
