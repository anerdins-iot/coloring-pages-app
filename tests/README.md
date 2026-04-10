# E2E Testing for Coloring Pages App

## Overview

This directory contains end-to-end tests for the "Måla med magi" coloring pages app using Playwright. The tests verify the core functionality of the app, including chat interface, voice mode selection, and message handling.

## Test Coverage

### Tests Implemented

1. **App Initialization**: Verifies the app loads with the correct title and welcome message
2. **Voice Mode Display**: Confirms all three voice modes (Blue, Green, Orange) are displayed
3. **Voice Mode Switching**: Tests switching between voice modes and verifies the UI updates
4. **Input Validation**: Verifies the send button is disabled until text is entered
5. **Message Sending**: Tests sending a message and verifies it appears in the chat
6. **Error Handling**: Verifies the app handles API errors gracefully
7. **UI Elements**: Confirms presence of input field, microphone button, and child-safe footer

### Manual Testing Results

Screenshots have been saved in the `screenshots/` directory showing:

- `01-initial-state.png`: App loads with welcome message and voice mode selector
- `02-message-typed.png`: Input field correctly captures text
- `03-message-sent-error.png`: Chat sends messages and displays error (expected when API key is missing)
- `04-green-voice-mode.png`: Green voice mode selection works
- `05-orange-voice-mode.png`: Orange voice mode selection works

## Running Tests

### Prerequisites

1. Install Playwright (if not already installed):
```bash
npm install --save-dev @playwright/test
```

2. Set required environment variable:
```bash
export GOOGLE_GENERATIVE_AI_API_KEY="your-actual-api-key"
```

### Run Tests

```bash
# Run all tests
npx playwright test

# Run tests with UI mode
npx playwright test --ui

# Run specific test file
npx playwright test tests/e2e/coloring-chat.spec.ts

# Run tests in debug mode
npx playwright test --debug
```

### Generate HTML Report

```bash
npx playwright show-report
```

## Known Limitations

### Without Google API Key

When the `GOOGLE_GENERATIVE_AI_API_KEY` environment variable is not set:

- ❌ Chat responses from Gemini 3.1 Flash Lite will fail with 503 error
- ❌ Image generation with Imagen 4 will not work
- ❌ Text-to-Speech (TTS) synthesis will not work
- ✅ Voice mode selection and switching works
- ✅ UI interactions work correctly
- ✅ Error handling is displayed

### Tested Functionality

✅ **App Structure & UI**
- Page title and layout
- Welcome message
- Voice mode buttons (Blue, Green, Orange)
- Input field and send button
- Chat message area
- Child-safe footer text

✅ **User Interactions**
- Typing messages into input field
- Sending messages
- Switching voice modes
- Button states (enabled/disabled)

✅ **Error Handling**
- Missing API key error is displayed appropriately
- Chat gracefully handles API failures

## Architecture Notes

### Voice Modes

The app supports three voice modes:

1. **Blue (Blå)**: Calm and clear - with text-to-speech
2. **Green (Grön)**: Happy and energetic - with text-to-speech
3. **Orange (Orange)**: Fun and playful - without text-to-speech

Each mode affects:
- The tone of the assistant's responses
- Whether text-to-speech is enabled
- The voice characteristics in TTS

### AI Integration

The app uses:
- **Chat API**: `/api/chat` - Gemini 3.1 Flash Lite for responses
- **TTS API**: `/api/tts` - Gemini TTS for text-to-speech
- **STT API**: `/api/stt` - Gemini STT for speech-to-text (microphone input)
- **Image Generation**: Via `generateColoringPage()` tool using Imagen 4

## Security Features

The app implements safety measures:

- Safety filters on Gemini API (blocks hate speech, dangerous content, harassment, sexually explicit content)
- Input validation on all API routes
- Child-friendly content enforcement
- Microphone and audio permissions handling

## Next Steps for Full Testing

To perform complete end-to-end testing with actual API responses:

1. Set the `GOOGLE_GENERATIVE_AI_API_KEY` environment variable
2. Run the tests with `npx playwright test`
3. Verify image generation by examining the generated coloring pages
4. Test text-to-speech playback with different voice modes
5. Test speech-to-text input with the microphone button

## Test Files

- `playwright.config.ts`: Playwright configuration
- `tests/e2e/coloring-chat.spec.ts`: Chat and voice mode tests
- `tests/README.md`: This file

## Screenshots

All screenshots are stored in the `screenshots/` directory:
```
screenshots/
├── 01-initial-state.png
├── 02-message-typed.png
├── 03-message-sent-error.png
├── 04-green-voice-mode.png
├── 05-orange-voice-mode.png
└── page-snapshot.md
```
