import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HalftoneCanvas, HalftoneParams } from './HalftoneCanvas';
import SimpleControlPanel from './SimpleControlPanel';
import { useAudioAnalyzer } from '../hooks/useAudioAnalyzer';
import starSvg from '../assets/star.svg';
import { useSocket } from '@/hooks/useSocket';

// Web Speech API type declarations
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

/* 
 * ══════════════════════════════════════════════════════════════════════════════════
 * DR TARA SINGH - VOICE CONVERSATION INTERFACE
 * Backend Integration Guide for LLM and TTS Systems
 * ══════════════════════════════════════════════════════════════════════════════════
 * 
 * REQUIRED BACKEND INTEGRATIONS:
 * 
 * 1. LLM INTEGRATION (4-second processing window):
 *    - Hook into startThinkingAnimation() function
 *    - Capture user question from 'capturedQuestion' variable
 *    - Process with LLM within 4-second rotation phase
 *    - Trigger showResponse() when ready
 * 
 * 2. TTS INTEGRATION (Variable duration):
 *    - Replace 10s placeholder in showResponse()
 *    - Connect TTS audio stream to audio analyzer
 *    - Use TTS completion event to trigger returnToListening()
 * 
 * 3. AUDIO STREAM INTEGRATION:
 *    - TTS audio must feed into the audio analyzer for visualization
 *    - Ensure audio reactivity during RESPONDING mode
 * 
 * SEARCH FOR: "** BACKEND TODO **" for specific integration points
 * ══════════════════════════════════════════════════════════════════════════════════
 */

// Animation mode definitions and timing constants
export const THINKING_ANIMATION_DURATION = 4500; // 4.5 seconds total
export const ROTATION_DURATION = 4000; // 4 seconds for rotation phase (4 spins)
export const RIPPLE_DURATION = 500; // 0.5 seconds for ripple phase

/* 
 * DR TARA SINGH - CONVERSATION FLOW & ANIMATION STATES
 * 
 * This defines the complete conversation flow for the AI character Dr Tara Singh.
 * Each state has specific visual/audio behaviors for the frontend, with clear
 * integration points for backend LLM and TTS systems.
 * 
 * CONVERSATION FLOW:
 * IDLE → [Wake Word] → LISTENING → [Question Captured] → THINKING → [LLM Complete] → RESPONDING → [TTS Complete] → LISTENING (loop)
 *                                                     ↓ [Speech Timeout]
 *                                                   IDLE
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * IDLE MODE:
 * - Trigger: App start, speech recognition timeout
 * - Color: Light blue (hsl(200, 100%, 60%))
 * - Animation: Infinite looping pulse (6s cycles)
 * - Parameters: pulseMaxRadius: 60, pulseFalloffWidth: 35
 * - Audio: No reactivity, wake word detection active
 * - UI: Shows "WAKE WORD: 'HEY TARA'" hint after 5s inactivity
 * - Backend: Waiting for user interaction
 * 
 * LISTENING MODE:
 * - Trigger: Wake word "Hey Tara" detected
 * - Color: Blue (#2172F4) 
 * - Animation: Audio-reactive pulse (responds to microphone input)
 * - Audio: Speech recognition active, microphone visualizer
 * - Behavior: Captures user's question via speech-to-text
 * - Timeout: Browser speech recognition timeout (5-10s silence)
 * - Backend Integration: Send captured question to LLM system
 * 
 * THINKING MODE - ** CRITICAL FOR BACKEND INTEGRATION **:
 * - Trigger: User question captured
 * - Color: Turquoise (#21F4DF)
 * - Duration: EXACTLY 4.5 seconds total
 *   • Phase 1: Star rotation + pulse (4 seconds) - LLM PROCESSING WINDOW
 *   • Phase 2: Ripple effect (0.5 seconds) - RESPONSE READY SIGNAL
 * - Parameters: pulseMaxRadius: 60, pulseFalloffWidth: 35
 * - Audio: No reactivity during processing
 * - ** BACKEND TODO **: 
 *   • Send question to LLM at start of Phase 1
 *   • LLM must return response within 4 seconds
 *   • Trigger ripple animation when response is ready
 *   • If LLM takes longer, extend rotation phase
 * 
 * RESPONDING MODE - ** TTS INTEGRATION REQUIRED **:
 * - Trigger: Thinking animation complete, LLM response ready
 * - Color: Light blue (same as idle - hsl(200, 100%, 60%))
 * - Animation: Audio-reactive pulse responding to TTS voice output
 * - Duration: Variable based on TTS audio length (currently 10s placeholder)
 * - Audio: TTS audio stream drives the visual pulse animation
 * - UI: Shows response text on screen during TTS playback
 * - ** BACKEND TODO **: 
 *   • Connect TTS audio stream to audio analyzer
 *   • Replace 10s timeout with TTS completion callback
 *   • Ensure TTS audio feeds into visualization system
 * - Flow: Returns to LISTENING mode for continuous conversation
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const VoiceChatStage: React.FC = () => {
  const [showControlPanel, setShowControlPanel] = useState(false);
  const [isChatMode, setIsChatMode] = useState(false);
  const [animationState, setAnimationState] = useState<'idle' | 'listening' | 'thinking' | 'responding'>('idle');
  const [originalDotColor] = useState('hsl(200, 100%, 60%)');
  const [userQuestion, setUserQuestion] = useState('');
  const [responseText, setResponseText] = useState('');
  const [showTextBox, setShowTextBox] = useState(false);
  const [wakeWordRecognition, setWakeWordRecognition] = useState<SpeechRecognition | null>(null);
  const [sessionTime, setSessionTime] = useState(0); // Time in seconds
  const [showIdleHint, setShowIdleHint] = useState(false);

  const { messages, sendMessage, resetMessages } = useSocket(crypto.randomUUID());

  // Refs to track current state values and avoid stale closures
  const animationStateRef = useRef(animationState);
  const startListeningStageRef = useRef<any>(null);
  const restartWakeWordRef = useRef<any>(null);
  const idleTimeoutRef = useRef<any>(null);
  const [params, setParams] = useState<HalftoneParams>({
    gridDensity: 36,
    maxDotSize: 85,
    minDotSize: 1,
    falloffType: 'exponential',
    falloffIntensity: 5.5,
    centerX: 50, // Changed to 50% as requested
    centerY: 50,
    dotColor: 'hsl(200, 100%, 60%)',
    backgroundColor: 'transparent',
    animationSpeed: 1,
    circularRadius: 580,
    audioEnabled: false,
    audioSensitivity: 1,
    bassInfluence: 0.5,
    midInfluence: 0.5,
    trebleInfluence: 0.5,
    audioSmoothing: 0.8,
    audioAnimationMode: 'combined',
    loopingMode: false,
    loopDuration: 7,
    loopCycles: -1,
    loopAnimationType: 'pulse',
    isRecording: false,
    recordingProgress: 0,
    pulseMaxRadius: 50,
    rippleRingWidth: 80,
    rippleIntensity: 1.5,
    rippleBoostAmount: 0.3,
    rippleFalloffSharpness: 2.5,
    rippleCyclePause: 0,
    pulseFalloffWidth: 35,
    frameRate: 60,
    offlineTemporalSamples: 2,
    maskEnabled: true,
    maskSize: 90,
    maskSvgPath: starSvg
  });

  const { audioData, error: audioError, startListening, stopListening } = useAudioAnalyzer({
    enabled: params.audioEnabled,
    smoothingTimeConstant: params.audioSmoothing
  });

  const setAudioEnabled = async (enabled: boolean) => {
    setParams(prev => ({ ...prev, audioEnabled: enabled }));
    if (enabled) {
      try {
        await startListening();
      } catch (e) {
        console.error('Failed starting audio:', e);
      }
    } else {
      stopListening();
    }
  };

  // Auto-start idle animation on component mount
  useEffect(() => {
    // Initialize chat mode and idle animation automatically
    setIsChatMode(true);
    setAnimationState('idle');
    setParams(prev => ({
      ...prev,
      loopingMode: true,
      loopCycles: -1,
      loopAnimationType: 'pulse',
      loopDuration: 6,
      pulseMaxRadius: 60,
      pulseFalloffWidth: 35
    }));

    // Start the infinite pulse animation after parameters are set
    setTimeout(() => {
      if ((window as any).playHalftoneLoop) {
        (window as any).playHalftoneLoop();
      }
    }, 200);
  }, []); // Empty dependency array - runs only on mount

  useEffect(() => {
    const handleKeyPress = (_event: KeyboardEvent) => {
      // Keep keypress handler for any additional functionality if needed
      // Animation now starts automatically, so this could be used for other features
    };

    document.addEventListener('keypress', handleKeyPress);

    return () => {
      document.removeEventListener('keypress', handleKeyPress);
    };
  }, [isChatMode]);

  const handleMessageSent = useCallback(() => {
    setAnimationState('thinking');

    // Calculate cycles for 4-second window (with 7s cycle duration, we want ~0.57 cycles)
    const thinkingCycles = Math.ceil(4 / 7); // 1 cycle to fit in 4 seconds

    setParams(prev => ({
      ...prev,
      dotColor: '#21F4DF', // Set permanent thinking color
      loopingMode: true, // Enable looping for thinking animation
      loopAnimationType: 'pulse', // Pulse animation with star rotation
      loopCycles: thinkingCycles,
      loopDuration: ROTATION_DURATION / 1000,  // Convert to seconds for the rotation phase
      pulseMaxRadius: 60, // Pulse reach (same as idle)
      pulseFalloffWidth: 35, // Pulse edge softness (same as idle)
      isThinking: true, // Enables star rotation
      maskRotationStartTime: performance.now() // Start rotation timer
    }));

    // Start color transition to thinking color
    if ((window as any).startColorTransition) {
      (window as any).startColorTransition('#21F4DF', 500);
    }

    // Trigger animation reset to restart from beginning
    if ((window as any).playHalftoneLoop) {
      (window as any).playHalftoneLoop();
    }

    // Switch to ripple after rotation phase completes - stay in thinking mode
    setTimeout(() => {
      setParams(prev => ({
        ...prev,
        loopAnimationType: 'ripple',
        loopDuration: RIPPLE_DURATION / 1000, // Convert to seconds
        loopCycles: 1,
        rippleRingWidth: 45,
        rippleBoostAmount: 0.15,
        rippleFalloffSharpness: 1.3,
        isThinking: true,  // Keep thinking state active to maintain color
        maskRotationStartTime: undefined,
        maskRotation: 0
        // Note: keeping isThinking true to maintain thinking color during ripple
      }));

      // Re-assert turquoise color to prevent reset when switching to ripple
      if ((window as any).startColorTransition) {
        (window as any).startColorTransition('#21F4DF', 0); // Instant, no transition
      }

      // Restart animation with ripple parameters
      if ((window as any).playHalftoneLoop) {
        (window as any).playHalftoneLoop();
      }
    }, ROTATION_DURATION);

    // Return to idle after complete thinking animation (give ripple full second)
    setTimeout(() => {
      setAnimationState('idle');
      setParams(prev => ({
        ...prev,
        loopCycles: -1,
        loopDuration: 6,  // Use updated cycle duration
        loopAnimationType: 'pulse',  // Back to pulse
        rippleRingWidth: 80,  // Restore original ripple settings
        rippleBoostAmount: 0.3,
        rippleFalloffSharpness: 2.5,
        isThinking: false,  // Turn off thinking state when returning to idle
        maskRotationStartTime: undefined,
        maskRotation: 0
      }));

      // Restart infinite animation
      if ((window as any).playHalftoneLoop) {
        (window as any).playHalftoneLoop();
      }
    }, THINKING_ANIMATION_DURATION); // Switch to idle exactly after thinking completes

    // Start color transition back to blue at the same time as idle switch
    setTimeout(() => {
      // Transition back to original color when switching to idle
      if ((window as any).startColorTransition) {
        (window as any).startColorTransition(originalDotColor, 500);
      }
    }, THINKING_ANIMATION_DURATION); // Change color exactly when thinking animation ends
  }, [originalDotColor]);

  // Update refs when values change
  useEffect(() => {
    animationStateRef.current = animationState;
  }, [animationState]);

  // Manage idle hint timer - show hint after 5 seconds of idle state
  useEffect(() => {
    // Clear existing timeout
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = null;
    }

    // Hide hint when not in idle state
    if (animationState !== 'idle') {
      setShowIdleHint(false);
      return;
    }

    // Set timeout to show hint after 5 seconds in idle state
    idleTimeoutRef.current = setTimeout(() => {
      setShowIdleHint(true);
    }, 5000);

    return () => {
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
        idleTimeoutRef.current = null;
      }
    };
  }, [animationState]);

  // Initialize wake word detection once on mount only
  useEffect(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.warn('Speech recognition not supported in this browser');
      return;
    }

    let recognition: any = null;
    let isListening = false;
    let mounted = true;

    const startRecognition = () => {
      if (isListening || !mounted) return;

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognition = new SpeechRecognition();

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        // Check both interim and final results for faster detection
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0].transcript.toLowerCase().trim();

          if (result.isFinal) {
            console.log('Wake word detection heard:', transcript);
          }

          // Check current state values using refs - detect on both interim and final
          if (transcript.includes('hey tara') &&
            animationStateRef.current === 'idle' &&
            startListeningStageRef.current) {
            console.log('Wake word detected! Starting listening stage...');
            startListeningStageRef.current();
            resetMessages()
            break; // Stop processing once detected
          }
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'aborted' || !mounted) return;
        console.error('Wake word recognition error:', event.error);
        isListening = false;

        // Restart if still idle
        if (mounted && animationStateRef.current === 'idle') {
          setTimeout(() => startRecognition(), 1000);
        }
      };

      recognition.onend = () => {
        isListening = false;
        // Restart if still idle
        if (mounted && animationStateRef.current === 'idle') {
          setTimeout(() => startRecognition(), 100);
        }
      };

      try {
        recognition.start();
        isListening = true;
        console.log('Wake word recognition started');
      } catch (error) {
        console.error('Failed to start wake word recognition:', error);
        isListening = false;
      }
    };

    // Store the restart function in ref so it can be called from returnToIdle
    restartWakeWordRef.current = startRecognition;

    setWakeWordRecognition(recognition);

    // Start recognition after a small delay to ensure refs are set
    setTimeout(() => {
      sendMessage('Whats for food today')
      startRecognition();
    }, 1000);

    return () => {
      mounted = false;
      if (recognition) {
        recognition.abort();
      }
    };
  }, []); // Empty dependency array - only run once on mount

  // Start listening stage when wake word is detected
  const startListeningStage = useCallback(async () => {
    setAnimationState('listening');
    setShowIdleHint(false); // Hide idle hint

    // CRITICAL: Stop wake word recognition to free microphone for Safari
    if (wakeWordRecognition) {
      wakeWordRecognition.abort();
    }

    // Add small delay after stopping wake word to ensure microphone is fully released (Safari)
    await new Promise(resolve => setTimeout(resolve, 100));

    // Change color to #2172F4 (blue)
    if ((window as any).startColorTransition) {
      (window as any).startColorTransition('#2172F4', 500);
    }

    // Start audio analyzer FIRST and ensure it gets microphone priority
    await setAudioEnabled(true);

    // Detect Safari for debugging
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (isSafari) {
      console.log('[Safari] Audio analyzer started, waiting longer before speech recognition...');
    }

    // Set all listening mode parameters at once including color and audio settings
    setParams(prev => ({
      ...prev,
      dotColor: '#2172F4', // Set permanent listening color
      loopingMode: false,
      audioAnimationMode: 'pulse',
      audioEnabled: true // Ensure audio is enabled in params
    }));

    // Start question recognition with longer delay to ensure audio analyzer has microphone priority (Safari)
    const delay = isSafari ? 750 : 400; // Extra time for Safari
    setTimeout(() => {
      if (isSafari) {
        console.log('[Safari] Starting question recognition after audio priority delay...');
      }
      startQuestionRecognition();
    }, delay);
  }, [setAudioEnabled]);

  // Update the ref when startListeningStage changes
  useEffect(() => {
    startListeningStageRef.current = startListeningStage;
  }, [startListeningStage]);

  // Start speech recognition for capturing user questions
  const startQuestionRecognition = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.warn('Speech recognition not supported for questions');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      console.log('Question recognition started');
      setShowTextBox(true);
      setUserQuestion('Listening...');
    };

    let capturedQuestion = '';

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
          capturedQuestion = finalTranscript; // Store final result locally
          console.log('Final Result', finalTranscript)
        } else {
          interimTranscript += transcript;
        }
      }

      // Show interim results while user is speaking
      setUserQuestion(finalTranscript || interimTranscript || 'Listening...');
    };

    recognition.onend = () => {
      console.log('Question recognition ended');
      console.log('Captured question:', capturedQuestion);
      sendMessage(capturedQuestion.trim());
      if (capturedQuestion && capturedQuestion.trim().length > 0) {
        // ** BACKEND INTEGRATION **: User question captured successfully
        // The captured question is stored in 'capturedQuestion' variable
        // This is what should be sent to the LLM system
        console.log('User question for LLM:', capturedQuestion);
        startThinkingAnimation();
      } else {
        // No question captured, return to idle
        returnToIdle();
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Question recognition error:', event.error);
      setUserQuestion('Sorry, I couldn\'t hear you clearly. Please try again.');
      setTimeout(() => returnToIdle(), 3000);
    };

    recognition.start();
  }, [userQuestion]);

  // Start thinking animation after question is captured - ** BACKEND INTEGRATION POINT **
  const startThinkingAnimation = useCallback(() => {
    setAnimationState('thinking');

    // Stop audio reactivity during LLM processing
    setParams(prev => ({ ...prev, audioEnabled: false }));
    stopListening();

    // ** BACKEND TODO **: Send captured user question to LLM here
    // - Extract question from userQuestion state
    // - Send to LLM API endpoint
    // - Handle LLM streaming/completion
    // - Store response for TTS conversion

    // Trigger thinking animation (4s rotation + 0.5s ripple)
    handleMessageSent();

    // ** BACKEND TODO **: Replace this timeout with LLM completion callback
    // When LLM response is ready (within 4s), trigger ripple and proceed to response
    // If LLM takes longer, extend the rotation phase duration
    setTimeout(() => {
      showResponse();
    }, THINKING_ANIMATION_DURATION + 2000); // Add delay for color transition
  }, [handleMessageSent, stopListening]);

  // Return to listening mode after response (for continuous conversation)
  const returnToListening = useCallback(async () => {
    setAnimationState('listening');
    // setResponseText('');
    resetMessages();
    setUserQuestion('Listening...');
    setShowTextBox(true);

    // Change color to #2172F4 (blue)
    if ((window as any).startColorTransition) {
      (window as any).startColorTransition('#2172F4', 500);
    }

    // Start audio analyzer for audio reactivity
    await setAudioEnabled(true);

    // Set listening mode parameters
    setParams(prev => ({
      ...prev,
      dotColor: '#2172F4', // Set permanent listening color
      loopingMode: false,
      audioAnimationMode: 'pulse',
      audioEnabled: true // Ensure audio is enabled in params
    }));

    // Start question recognition with delay for Safari compatibility
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const delay = isSafari ? 750 : 400;
    setTimeout(() => {
      startQuestionRecognition();
    }, delay);
  }, [setAudioEnabled, startQuestionRecognition]);

  // Show AI response - ** BACKEND INTEGRATION POINT **
  const showResponse = useCallback(async () => {
    setAnimationState('responding');
    setUserQuestion('');

    // ** BACKEND TODO **: Replace this placeholder text with LLM response
    // setResponseText("Hi, I'm Dr Tara Singh, former Mission Specialist in astrobiology and life sciences research onboard the International Space Station. I'm just back from my first mission in space and busy training for my next. I'm here to answer any questions you might have about space exploration, life onboard the ISS and what it's like to be astronaut. To get started, press and hold the orange button and ask away.");

    // Configure RESPONDING mode: idle color + audio reactivity for TTS
    setParams(prev => ({
      ...prev,
      dotColor: 'hsl(200, 100%, 60%)', // Use idle color (light blue)
      loopingMode: false, // Disable looping
      audioEnabled: true, // Enable audio reactivity for TTS
      audioAnimationMode: 'pulse' // Pulse responds to TTS audio
    }));

    // Start audio analyzer for TTS visualization
    await setAudioEnabled(true);

    // Transition color to idle color for responding
    if ((window as any).startColorTransition) {
      (window as any).startColorTransition('hsl(200, 100%, 60%)', 500);
    }

    // ** BACKEND TODO **: Replace 10s timeout with TTS completion callback
    // This 10-second placeholder should be replaced with:
    // - TTS audio generation and playback
    // - TTS completion event listener
    // - Audio stream connection to visualizer
    setTimeout(() => {
      returnToListening();
    }, 10000); // 10s placeholder for TTS playback duration
  }, [returnToListening, setAudioEnabled]);

  // Return to idle state
  const returnToIdle = useCallback(() => {
    setAnimationState('idle');
    setUserQuestion('');
    // setResponseText('');
    resetMessages();
    setShowTextBox(false);

    // Return to original color
    if ((window as any).startColorTransition) {
      (window as any).startColorTransition(originalDotColor, 500);
    }

    // Reset to idle animation with original color
    setParams(prev => ({
      ...prev,
      dotColor: originalDotColor, // Set permanent idle color
      audioEnabled: false,
      loopingMode: true,
      loopCycles: -1,
      loopAnimationType: 'pulse',
      loopDuration: 6
    }));

    // Restart idle animation
    if ((window as any).playHalftoneLoop) {
      (window as any).playHalftoneLoop();
    }

    // Actually restart wake word recognition after a small delay
    setTimeout(() => {
      if (restartWakeWordRef.current) {
        restartWakeWordRef.current();
      }
    }, 500); // Small delay to ensure state has settled
  }, [originalDotColor]);

  // Timer functionality - starts when component mounts
  useEffect(() => {
    const timer = setInterval(() => {
      setSessionTime(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Format time as HH:MM:SS
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="voice-chat-stage">
      {/* Top bar */}
      <div className="top-bar">
        <div className="top-bar-left" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              width: '8px',
              height: '8px',
              backgroundColor: '#4CAF50',
              borderRadius: '50%',
              display: 'inline-block'
            }}
            title="Online"
          />
          DR TARA SINGH
        </div>
        <div className="top-bar-center">{formatTime(sessionTime)}</div>
        <div className="top-bar-right">
          <button
            className="control-panel-toggle"
            onClick={() => setShowControlPanel(!showControlPanel)}
          >
            {showControlPanel ? '-' : '+'}
          </button>
        </div>
      </div>

      {/* Full-screen canvas */}
      <div className="halftone-container">
        <HalftoneCanvas
          params={params}
          audioData={audioData}
        />
      </div>

      {/* Floating control panel */}
      {showControlPanel && (
        <div className="floating-control-panel">
          <button
            className="minimize-controls-btn"
            onClick={() => setShowControlPanel(false)}
          >
            -
          </button>
          <SimpleControlPanel
            params={params}
            onParamsChange={setParams}
            onAudioToggle={setAudioEnabled}
            onEnd={() => { }} // No-op for voice mode
          />
        </div>
      )}

      {/* Audio error display */}
      {params.audioEnabled && audioError && (
        <div className="audio-error">
          <strong>Audio Error:</strong> {audioError}
        </div>
      )}

      {/* Floating text box for questions and responses */}
      {showTextBox && (userQuestion || responseText) && (
        <div className={`floating-text-box${responseText ? ' response-mode' : ''}`}>
          {userQuestion || messages.map((message: any) => message.text).join('\n')}
        </div>
      )}

      {/* Render the answer */}
      {messages.length > 0 && <div className={`floating-text-box${responseText ? ' response-mode' : ''}`}>
        {messages.map(m => m.text).join('\n')}
      </div>}

      {/* Idle hint - appears after 5 seconds of inactivity */}
      {showIdleHint && (
        <div className="idle-hint">
          Wake word: "Hey Tara"
        </div>
      )}

    </div>
  );
};

export default VoiceChatStage;