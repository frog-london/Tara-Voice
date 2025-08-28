# Dr Tara Singh - Voice Conversation Interface

A React-based frontend for an AI conversational experience with Dr Tara Singh, an astronaut character. This interface provides a complete voice-driven interaction system with visual feedback through halftone animations.

## 🚀 Character Profile
**Dr Tara Singh** - Former Mission Specialist in astrobiology and life sciences research aboard the International Space Station. Currently training for her next mission and available to answer questions about space exploration, life aboard the ISS, and astronaut experiences.

## 🎯 Features

- **Complete Voice Interface**: Wake word activation, speech recognition, and TTS integration ready
- **Dynamic Animation States**: Visual feedback for each conversation phase
- **Audio-Reactive Visualizations**: Halftone effects respond to both microphone input and TTS output
- **Continuous Conversation Flow**: Seamless interaction loops without wake word repetition
- **Backend Integration Ready**: Clear hooks for LLM and TTS systems

## 📊 Conversation Flow

```
IDLE → [Wake Word: "Hey Tara"] → LISTENING → [Question Captured] → THINKING → [LLM Complete] → RESPONDING → [TTS Complete] → LISTENING
  ↑                                                        ↓
  ← ← ← ← ← ← ← [Speech Recognition Timeout] ← ← ← ← ← ← ←
```

## 🎨 Animation States

### IDLE MODE
- **Trigger**: App start, speech recognition timeout
- **Visual**: Light blue infinite pulse (6s cycles)
- **Audio**: Wake word detection active
- **UI**: Shows "WAKE WORD: 'HEY TARA'" hint after 5s inactivity
- **Backend**: Waiting for user interaction

### LISTENING MODE
- **Trigger**: Wake word "Hey Tara" detected
- **Visual**: Blue audio-reactive pulse responding to microphone
- **Audio**: Speech recognition active, microphone visualization
- **Behavior**: Captures user questions via speech-to-text
- **Timeout**: Browser speech recognition timeout (5-10s silence)

### THINKING MODE ⚡ **CRITICAL FOR LLM INTEGRATION**
- **Trigger**: User question captured
- **Visual**: Turquoise color with star rotation + pulse
- **Duration**: EXACTLY 4.5 seconds total
  - **Phase 1**: 4.0 seconds star rotation (LLM processing window)
  - **Phase 2**: 0.5 seconds ripple effect (response ready signal)
- **LLM Requirements**:
  - Response must be generated within 4-second window
  - Ripple animation signals LLM completion
  - Extend rotation phase if processing takes longer

### RESPONDING MODE 🔊 **CRITICAL FOR TTS INTEGRATION**
- **Trigger**: Thinking animation complete, LLM response ready  
- **Visual**: Light blue audio-reactive pulse responding to TTS voice
- **Duration**: Variable based on TTS audio length (10s placeholder)
- **Audio**: TTS audio stream drives visualization
- **UI**: Response text displayed during TTS playback
- **Flow**: Returns to LISTENING for continuous conversation

## 🔧 Backend Integration Points

### 1. LLM Integration
**Location**: `startThinkingAnimation()` function in `VoiceChatStage.tsx`

```typescript
// User question available in 'capturedQuestion' variable
const userQuestion = capturedQuestion; // Send this to LLM

// Replace this timeout with LLM completion callback:
setTimeout(() => {
  showResponse(); // Call this when LLM response ready
}, THINKING_ANIMATION_DURATION + 2000);
```

**Requirements**:
- Process LLM response within 4-second thinking window
- Call `showResponse()` when response is ready
- Handle longer processing by extending rotation phase

### 2. TTS Integration  
**Location**: `showResponse()` function in `VoiceChatStage.tsx`

```typescript
// Replace placeholder text with LLM response:
setResponseText(llmResponse); // Use actual LLM response

// Replace 10s timeout with TTS completion event:
setTimeout(() => {
  returnToListening(); // Call this when TTS playback complete
}, 10000); // Replace with TTS duration/completion callback
```

**Requirements**:
- Connect TTS audio stream to audio analyzer for visualization
- Call `returnToListening()` when TTS playback completes
- Ensure TTS audio feeds into the visual pulse animation

### 3. Audio Stream Integration
**Location**: Audio analyzer system in `useAudioAnalyzer.ts`

**Requirements**:
- TTS audio output must connect to the audio analyzer
- During RESPONDING mode, visualizations should react to TTS voice
- Maintain audio reactivity while TTS plays

## 🔍 Integration Search Guide

Search the codebase for these markers:

- `** BACKEND TODO **` - Specific integration points requiring backend work
- `** BACKEND INTEGRATION **` - Areas where data flows between frontend/backend
- `capturedQuestion` - Variable containing user's question for LLM
- `setResponseText` - Where LLM response should be set
- `returnToListening` - Function to call when TTS completes

## 📁 Project Structure

```
voice-tara/
├── src/
│   ├── App.tsx                    # Main app component
│   ├── components/
│   │   ├── VoiceChatStage.tsx     # 🎯 Main conversation interface (INTEGRATION FOCUS)
│   │   ├── HalftoneCanvas.tsx     # Visual animation system
│   │   └── SimpleControlPanel.tsx # Development controls
│   ├── hooks/
│   │   └── useAudioAnalyzer.ts    # 🔊 Audio processing (TTS INTEGRATION)
│   ├── assets/
│   │   ├── star.svg               # Animation mask
│   │   └── ISS-ph.png            # Background image
│   └── styles/
│       └── App.css               # Interface styling
```

## ⚙️ Development Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production  
npm run build

# Preview production build
npm run preview
```

## 🎮 Testing & Development

- **Wake Word**: Say "Hey Tara" to activate listening mode
- **Control Panel**: Click + button (top-right) for animation controls
- **Debug Mode**: Check browser console for conversation flow logs
- **Audio Test**: Enable audio reactivity in control panel

## ⏱️ Timing Constants

```typescript
THINKING_ANIMATION_DURATION = 4500; // Total thinking time (4.5s)
ROTATION_DURATION = 4000;           // LLM processing window (4s)  
RIPPLE_DURATION = 500;              // Response ready signal (0.5s)
```

## 🐞 Error Handling

The system handles various error states:
- Speech recognition failures → Return to idle
- Microphone access denied → Audio error display
- Wake word detection errors → Auto-restart recognition
- No question captured → Return to idle after timeout

## 🚦 System States

| State | Color | Animation | Audio | Purpose |
|-------|--------|-----------|-------|---------|
| IDLE | Light Blue | Infinite Pulse | Wake Word Detection | Waiting |
| LISTENING | Blue | Mic-Reactive | Speech Recognition | Capturing Question |
| THINKING | Turquoise | Rotation + Ripple | None | LLM Processing |
| RESPONDING | Light Blue | TTS-Reactive | TTS Playback | Voice Response |

## 📝 Backend Implementation Checklist

- [ ] LLM API integration in `startThinkingAnimation()`
- [ ] Question extraction from `capturedQuestion` variable
- [ ] Response setting via `setResponseText()`
- [ ] TTS audio generation and playback
- [ ] TTS audio stream connection to visualizer
- [ ] TTS completion callback to `returnToListening()`
- [ ] Error handling for LLM/TTS failures
- [ ] Audio stream routing for visualization

## 🔗 Key Functions for Backend Integration

| Function | Purpose | Integration Point |
|----------|---------|-------------------|
| `startThinkingAnimation()` | Initiates LLM processing | Send question to LLM |
| `showResponse()` | Displays and speaks response | TTS generation & playback |
| `returnToListening()` | Returns to listening mode | Call when TTS complete |

---

**Ready for Backend Integration** ✅  
Search for `** BACKEND TODO **` in the code for specific integration points.