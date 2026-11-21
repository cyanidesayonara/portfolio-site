---
title: "Stem separation in Python without PyTorch: ONNX Runtime and DirectML"
description: "How stemma runs HTDemucs, MDX-Net and beat tracking locally on Windows GPUs and CPUs without shipping the PyTorch runtime."
date: 2026-11-21
tags: [python, onnx, directml, audio, dsp]
cover: /img/projects/stemma-takes.png
coverAlt: stemma mixer showing separated instrument stems and recorded takes
draft: true
---

<!-- DRAFT: written from the stemma repo (PROJECT.md and src/onnx_session.py). Review, edit in your own voice, then set draft to false. -->

If you build an audio ML app in Python, the default advice is simple: `pip install torch`, bundle CUDA, and ship a multi-gigabyte installer that still leaves AMD and Intel laptop GPUs running on CPU.

For [stemma](https://github.com/cyanidesayonara/stemma), I wanted stem separation to run 100% locally on a regular Windows machine without forcing users to install Python, CUDA toolkits, or a massive PyTorch runtime. Moving inference to ONNX Runtime with DirectML cut the distribution down to a regular desktop app while keeping GPU acceleration and a clean CPU fallback.

## Moving STFT and iSTFT out of the model

ONNX exports of audio separation models strip out the front-end spectral transforms and leave the pure neural graph in the `.onnx` file. That moves all signal preparation back into Python, where NumPy handles it predictably:

- **HTDemucs v4 (`src/separator.py`):** Runs both the four-stem (`vocals`, `drums`, `bass`, `other`) and six-stem (adding `guitar` and `piano`) models, doing all STFT and iSTFT pre- and post-processing in NumPy around the ONNX graph inside a background `QThread`.
- **MDX-Net (`src/mdx_separator.py`):** Splits vocals and backing (`other`), managing STFT packing, windowing, context trimming, and overlap-add reconstruction in NumPy with zero PyTorch dependency.

Model files stay out of the installer entirely. On first import, `src/model_manager.py` fetches the converted ONNX artifacts, checks their SHA-256 hashes, and atomically publishes them into the user's app data directory.

## DirectML in practice (`src/onnx_session.py`)

DirectML gives ONNX Runtime a vendor-neutral Windows GPU path across AMD, Intel, and NVIDIA cards, though configuring a session takes a few guardrails learned the hard way:

- **Defer the heavy import.** `onnxruntime` is imported lazily inside `create_onnx_session()` so the PySide6 practice window launches immediately instead of stalling before the UI appears.
- **Keep DirectML deterministic.** When `DmlExecutionProvider` is available, sessions set `enable_mem_pattern = False` and `execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL`, ordering providers as `["DmlExecutionProvider", "CPUExecutionProvider"]`.
- **Know when to skip the GPU.** `create_onnx_session()` takes a `use_gpu` flag. MDX-Net requests DirectML first and transparently falls back to CPU if session initialization fails—surfacing `"DirectML GPU"` or `"CPU fallback"` directly in the import progress status. HTDemucs passes `use_gpu=False` and goes straight to CPU, because the current four- and six-stem ONNX exports fail graph compilation on DirectML (tracked in [issue #125](https://github.com/cyanidesayonara/stemma/issues/125)); skipping the doomed GPU attempt avoids both wasted startup seconds and console error spam.
- **Distinguish corrupt downloads from hardware limits.** Catching every failure as a generic fallback hides broken model caches. `is_damaged_model_error()` checks specifically for `InvalidProtobuf`, `NoSuchFile`, and `InvalidGraph` (plus external-data and protobuf parse text) and raises `ModelDamagedError` so the UI prompts for a clean re-download instead of masking file corruption.

## Cleaning up bleed and keeping time in NumPy

Once the neural model produces raw stem waveforms, a few lightweight DSP stages finish the job in pure NumPy and `librosa`:

- **Bleed reduction (`src/post_processing.py`):** Runs in ~10-second chunks to keep memory flat, computing magnitude-based Wiener soft masks across stems followed by an RMS-envelope soft gate that trims faint ghost bleed during silent bars.
- **Beats, keys, and chords (`src/beat_detector.py`):** Uses chunked inference on the `beat_this` ONNX model for BPM and downbeat tracking, Krumhansl-Schmuckler profiles for key detection, and Viterbi-smoothed chroma for live major/minor chord readouts.
- **Real-time speed and pitch (`src/stretch.py`):** Changing tempo or transposing ±7 semitones while practicing happens live inside the `sounddevice` output callback via a NumPy phase vocoder (with identity phase locking so the mix holds its level) and `soxr` resampling. Nothing has to be pre-rendered to disk when you drop a loop down to 0.75× speed.
