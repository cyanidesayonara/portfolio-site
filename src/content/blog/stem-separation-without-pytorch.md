---
title: "Stem separation in Python without PyTorch: ONNX Runtime and DirectML"
description: "How stemma runs HTDemucs, MDX-Net and beat tracking locally on Windows GPUs and CPUs without shipping the PyTorch runtime."
date: 2026-10-14
tags: [python, onnx, directml, audio, dsp]
project: stemma
cover: /img/projects/stemma-takes.png
coverAlt: stemma mixer showing separated instrument stems and recorded takes
---

Audio ML in Python usually starts with `pip install torch`. For a desktop app, that means shipping a large runtime and still only getting GPU acceleration where that runtime supports the user's hardware.

For [stemma](https://github.com/cyanidesayonara/stemma), I wanted stem separation to run 100% locally on a regular Windows machine without forcing users to install Python, CUDA toolkits, or a massive PyTorch runtime. Running inference on ONNX Runtime with DirectML from the start kept it a regular desktop app, with GPU acceleration where it works and a clean CPU fallback.

## Moving STFT and iSTFT out of the model

In stemma's converted models, the spectral transforms live outside the `.onnx` graph. Signal preparation happens in Python, where NumPy handles it predictably:

- **HTDemucs v4 (`src/separator.py`):** Runs both the four-stem (`vocals`, `drums`, `bass`, `other`) and six-stem (adding `guitar` and `piano`) models, doing all STFT and iSTFT pre- and post-processing in NumPy around the ONNX graph inside a background `QThread`.
- **MDX-Net (`src/mdx_separator.py`):** Splits vocals and backing (`other`), managing STFT packing, windowing, context trimming, and overlap-add reconstruction in NumPy with zero PyTorch dependency.

Model files stay out of the installer entirely. On first import, `src/model_manager.py` fetches the converted ONNX artifacts, checks their SHA-256 hashes, and atomically publishes them into the user's app data directory.

## DirectML in practice (`src/onnx_session.py`)

DirectML gives ONNX Runtime a vendor-neutral Windows GPU path across AMD, Intel, and NVIDIA cards, though configuring a session takes a few guardrails learned the hard way:

- **Defer the heavy import.** `onnxruntime` is imported lazily inside `create_onnx_session()` because it's heavy and only needed once inference actually runs.
- **Meet DirectML's session requirements.** When `DmlExecutionProvider` is available, sessions set `enable_mem_pattern = False` and `execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL`, ordering providers as `["DmlExecutionProvider", "CPUExecutionProvider"]`.
- **Know when to skip the GPU.** `create_onnx_session()` takes a `use_gpu` flag. MDX-Net requests DirectML first and transparently falls back to CPU if session initialization fails—surfacing `"DirectML GPU"` or `"CPU fallback"` directly in the import progress status. HTDemucs passes `use_gpu=False` and goes straight to CPU, because the current four- and six-stem ONNX exports fail graph compilation on DirectML (tracked in [issue #125](https://github.com/cyanidesayonara/stemma/issues/125)); skipping the doomed GPU attempt avoids both wasted startup seconds and console error spam.
- **Distinguish corrupt downloads from hardware limits.** A generic fallback would hide broken model caches. `is_damaged_model_error()` recognizes `InvalidProtobuf`, `NoSuchFile` and `InvalidGraph` failures (plus external-data and protobuf parse text), and when the CPU session hits one, `create_onnx_session()` raises `ModelDamagedError`. The UI then says the model was removed and asks you to import the song again to download a fresh copy, instead of masking the corruption.

## Cleaning up bleed and keeping time in NumPy

Once the neural model produces raw stem waveforms, a few lightweight DSP stages finish the job in pure NumPy and `librosa`:

- **Bleed reduction (`src/post_processing.py`):** Runs in ~10-second chunks to keep memory flat, computing magnitude-based Wiener soft masks across stems followed by an RMS-envelope soft gate that trims faint ghost bleed during silent bars.
- **Beats, keys, and chords (`src/beat_detector.py`):** Uses chunked inference on the `beat_this` ONNX model for BPM and downbeat tracking, Krumhansl-Schmuckler profiles for key detection, and Viterbi-smoothed chroma for live major/minor chord readouts.
- **Real-time speed and pitch (`src/stretch.py`):** Changing tempo or transposing ±7 semitones while practicing happens live inside the `sounddevice` output callback via a NumPy phase vocoder (with identity phase locking so the mix holds its level) and `soxr` resampling. Nothing has to be pre-rendered to disk when you drop a loop down to 0.75× speed.
