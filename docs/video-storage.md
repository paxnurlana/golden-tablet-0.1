# Video storage and compression

New MP4/WebM uploads are streamed to `JOURNAL_DATA_DIR/video-upload`, capped at 500 MiB. Images/PDF retain the 8 MiB limit. FFmpeg encodes one video at a time with H.264 CRF 21, two encoder threads, AAC 96 kb/s, faststart and at most 30 fps. Resolution is preserved (odd dimensions are padded by at most one pixel). If transcoding increases size, the original is retained instead. The user previews before accepting; existing attachments are never recompressed automatically.

Accepted videos use immutable files in `media/<attachment-id>.media` with sidecar metadata. SQLite keeps ownership, MIME, name and size; the legacy non-null BLOB is empty for these external files. Old SQLite BLOB attachments remain readable. Copying Workflow cards clones external files as independent hard links where possible, with a copy fallback.

Unconfirmed previews are stored in `video-pending` and expire after 24 hours; expired previews are removed when the next compression starts. Failed uploads remove their temporary files. Cancelling a preview discards it, without touching the user's original recording. Uploads and encoding are bounded, but compression still consumes CPU and disk space; byte-size reduction cannot be guaranteed.

## Complete backup

Run `node scripts/backup-local-journal.cjs` (or `pnpm local:backup`). This makes a consistent SQLite snapshot, copies referenced external media and writes `COMPLETE.json` only after success. A `.db` file alone is NOT a complete backup of new videos. JSON export is metadata only and is NOT a restore archive.

To restore, stop the app and preserve the current data directory first. Restore `journal.db` AND the `media` folder from the same complete snapshot into a clean data directory; start with `JOURNAL_DATA_DIR` pointing there. Do not mix live WAL/SHM files with a restored snapshot. The FFmpeg executable comes from the `ffmpeg-static` dependency's approved install script; `JOURNAL_DATA_DIR` must be writable and FFmpeg must be installed on the runtime host.
