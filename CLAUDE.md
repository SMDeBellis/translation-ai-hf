# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a real-time AI-powered translation application that combines speech-to-text, language detection, text translation, and text-to-speech capabilities. The application supports bidirectional translation between English and Spanish, with both voice and keyboard input modes.

## Core Architecture

The application follows a modular architecture with these key components:

### Main Application (`ai-translator.py`)
- Entry point that orchestrates all translation pipeline components
- Initializes models, manages user input modes, and handles the main translation loop
- Integrates Whisper (speech-to-text), Helsinki-NLP models (translation), and text-to-speech engines

### Audio Input System (`consumers/`)
- **MicrophoneListener**: Keyboard listener that triggers recording on Alt-Gr key press/release
- **QueueInserter**: Audio capture thread that records microphone input using PyAudio
- Uses threaded architecture with Events for coordination between keyboard input and audio recording

### Translation Caching (`caching/`)
- **TranslationsCache**: JSON-based caching system that stores translation pairs to avoid re-computing
- Supports numpy array serialization for potential future audio caching
- Cache persists between application runs in `language-cache.json`

### Text-to-Speech (`t2s/`)
- **TextToSpeech**: Wrapper around pyttsx3 for voice synthesis
- Supports language-specific voice selection (English and Spanish voices)
- Configurable rate and volume settings

## Development Commands

### Environment Setup
```bash
# macOS installation
pip install -r requirements-macos.txt

# Linux installation (with CUDA support)
pip install -r requirements-linux.txt
```

### Running the Application
```bash
# Main translation application
python ai-translator.py

# Audio recording test utility
python wav-file-tester.py

# Microphone input system test
python tester.py
```

## Model Management

The application uses a local model caching strategy:

### Pre-trained Models Used
- **Speech-to-Text**: OpenAI Whisper Large V3 (`openai/whisper-large-v3`)
- **English→Spanish**: Helsinki-NLP OPUS MT (`Helsinki-NLP/opus-mt-tc-big-en-es`)
- **Spanish→English**: Helsinki-NLP OPUS MT (`Helsinki-NLP/opus-mt-es-en`)
- **Language Detection**: langdetect library for input language identification

### Model Storage Structure
```
models/
├── Helsinki-NLP/
│   ├── opus-mt-es-en/          # Spanish to English model
│   └── opus-mt-tc-big-en-es/   # English to Spanish model
└── dewdev/
    └── language_detection/      # Language detection model

tokenizers/
├── Helsinki-NLP/
│   ├── opus-mt-es-en/          # Spanish to English tokenizer
│   └── opus-mt-tc-big-en-es/   # English to Spanish tokenizer
└── dewdev/
    └── language_detection/      # Language detection tokenizer
```

Models are automatically downloaded on first run and cached locally using the `save()` function. The `get_model()` and `get_processor()` helper functions check for local copies before downloading from Hugging Face.

## Key Implementation Details

### Device Detection
- Automatically detects CUDA availability and sets appropriate torch dtype
- Falls back to CPU with float32 if CUDA unavailable
- Device selection affects model loading and pipeline performance

### Audio Processing
- Records at 24kHz sample rate with single channel
- Uses PyAudio for real-time audio capture
- Writes temporary WAV files for Whisper processing (limitation of current implementation)

### Translation Pipeline
1. Audio input → Whisper (speech-to-text)
2. Text → langdetect (language identification)
3. Text → Helsinki-NLP models (translation)
4. Translated text → pyttsx3 (text-to-speech)
5. All translations cached for future use

### Input Modes
- **Audio Mode**: Hold Alt-Gr (Option-Right on macOS) to record voice input
- **Keyboard Mode**: Direct text input via command line
- Special commands: "end program" (exit), "repeat last" (replay last translation)

## Platform Considerations

### macOS-specific
- Uses PyObjC frameworks for system integration
- Requires py3-tts for text-to-speech
- Uses specific voice IDs: `com.apple.eloquence.es-ES.Eddy`, `com.apple.eloquence.en-US.Eddy`

### Linux-specific  
- Requires evdev for keyboard input handling
- Uses pyttsx3 for text-to-speech
- Includes NVIDIA CUDA dependencies for GPU acceleration

## Testing Utilities

- **`tester.py`**: Standalone microphone input testing with keyboard listener
- **`wav-file-tester.py`**: Records 5-second audio clips and tests Whisper transcription
- Both utilities help debug audio pipeline issues independently of the main application