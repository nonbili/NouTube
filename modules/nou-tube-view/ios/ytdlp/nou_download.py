"""One progressive MP4, with no external programs or downloaded Python code."""

from pathlib import Path
from urllib.parse import urlsplit
from uuid import uuid4

from yt_dlp import YoutubeDL
from yt_dlp.globals import plugin_dirs
from yt_dlp.utils import sanitize_filename

plugin_dirs.value = []


def download(url, directory, proxy=None, on_progress=None):
    parsed = urlsplit(url)
    if parsed.scheme != "https" or parsed.hostname not in {
        "youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be",
    } or parsed.username is not None or parsed.password is not None or parsed.port not in (None, 443):
        raise ValueError("Enter a YouTube video URL over HTTPS.")

    root = Path(directory)
    temp_path = root / f".nou-{uuid4().hex}.mp4"
    def hook(status):
        if not on_progress:
            return
        state = status.get("status")
        if state == "downloading":
            total = status.get("total_bytes") or status.get("total_bytes_estimate") or 0
            downloaded = status.get("downloaded_bytes") or 0
            pct = (downloaded * 100.0 / total) if total > 0 else 0.0
            percent_str = (status.get("_percent_str") or "").strip()
            speed_str = (status.get("_speed_str") or "").strip()
            line = f"{percent_str} {speed_str}".strip() or f"{pct:.1f}%"
            on_progress(min(99.0, max(0.0, pct)), line)
        elif state == "finished":
            on_progress(100.0, "")

    options = {
        "format": "best[ext=mp4][protocol=https]",
        "outtmpl": str(temp_path).replace("%", "%%"),
        "noplaylist": True,
        "allowed_extractors": ["youtube"],
        "postprocessors": [],
        "cachedir": False,
        "socket_timeout": 20,
        "retries": 2,
        "quiet": True,
        "noprogress": True,
        "fixup": "never",
        "js_runtimes": {},
        "remote_components": set(),
        "extractor_args": {"youtube": {"player_client": ["android", "android_vr", "default"]}},
        "progress_hooks": [hook],
    }
    if proxy:
        options["proxy"] = proxy
    try:
        with YoutubeDL(options) as ydl:
            info = ydl.extract_info(url, download=True)
        if not temp_path.is_file():
            raise RuntimeError("yt-dlp didn't produce an MP4 file.")
        name = sanitize_filename(info.get("title") or "Video", restricted=True)[:120]
        name = name.strip(".") or "Video"
        file_path = root / f"{name}-{uuid4().hex[:8]}.mp4"
        temp_path.rename(file_path)
        return str(file_path)
    finally:
        temp_path.unlink(missing_ok=True)
        temp_path.with_suffix(".mp4.part").unlink(missing_ok=True)
