import { useRef, useEffect, useState, useCallback } from 'react';

interface AudioData {
  frequencyData: Uint8Array;
  bassLevel: number;
  midLevel: number;
  trebleLevel: number;
  averageLevel: number;
}

interface UseAudioAnalyzerOptions {
  fftSize?: number;
  smoothingTimeConstant?: number;
  enabled?: boolean;
}

export const useAudioAnalyzer = (options: UseAudioAnalyzerOptions = {}) => {
  // Log browser environment immediately
  if ((window as any).AUDIO_DEBUG) {
    console.log('[AudioAnalyzer] Browser Environment:', {
      protocol: window.location.protocol,
      host: window.location.host,
      isSecureContext: window.isSecureContext,
      hasGetUserMedia: !!navigator.mediaDevices?.getUserMedia,
      userAgent: navigator.userAgent.substring(0, 100)
    });
  }
  const {
    fftSize = 2048,
    smoothingTimeConstant = 0.8,
    enabled = false
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioData, setAudioData] = useState<AudioData>({
    frequencyData: new Uint8Array(fftSize / 2),
    bassLevel: 0,
    midLevel: 0,
    trebleLevel: 0,
    averageLevel: 0
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number>();

  const enabledRef = useRef(enabled);
  const isListeningRef = useRef(isListening);
  
  // Update refs when state changes
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);
  
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  const analyzeAudio = useCallback(() => {
    if (!analyzerRef.current) return;

    const analyzer = analyzerRef.current;
    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const timeDataArray = new Uint8Array(bufferLength);
    const floatArray = new Float32Array(bufferLength);
    
    // Get both frequency and time domain data
    analyzer.getByteFrequencyData(dataArray);
    analyzer.getByteTimeDomainData(timeDataArray);
    analyzer.getFloatFrequencyData(floatArray);
    
    // Check for time domain audio activity (more reliable for detecting sound)
    let maxAmplitude = 0;
    let rmsAmplitude = 0;
    for (let i = 0; i < timeDataArray.length; i++) {
      const amplitude = Math.abs(timeDataArray[i] - 128);
      maxAmplitude = Math.max(maxAmplitude, amplitude);
      rmsAmplitude += amplitude * amplitude;
    }
    rmsAmplitude = Math.sqrt(rmsAmplitude / timeDataArray.length);
    
    // Check if frequency data is all zeros (common issue)
    const maxFreqValue = Math.max(...dataArray);
    
    // If byte frequency data is all zeros, try to reconstruct from float data
    if (maxFreqValue === 0 && maxAmplitude > 1) {
      if ((window as any).AUDIO_DEBUG) console.log('[AudioAnalyzer] Converting float to byte data...');
      for (let i = 0; i < bufferLength; i++) {
        // Convert dB to 0-255 range (floatArray is in dB, typically -100 to 0)
        const dbValue = floatArray[i];
        dataArray[i] = dbValue === -Infinity ? 0 : Math.max(0, Math.min(255, (dbValue + 100) * 2.55));
      }
    }

    // Calculate frequency ranges
    const bassEnd = Math.floor(bufferLength * 0.1); // 0-10% of frequency range
    const midEnd = Math.floor(bufferLength * 0.5);  // 10-50% of frequency range
    // Treble is from midEnd to bufferLength

    let bassSum = 0, midSum = 0, trebleSum = 0, totalSum = 0;

    for (let i = 0; i < bufferLength; i++) {
      totalSum += dataArray[i];
      
      if (i < bassEnd) {
        bassSum += dataArray[i];
      } else if (i < midEnd) {
        midSum += dataArray[i];
      } else {
        trebleSum += dataArray[i];
      }
    }

    const bassLevel = bassSum / bassEnd / 255;
    const midLevel = midSum / (midEnd - bassEnd) / 255;
    const trebleLevel = trebleSum / (bufferLength - midEnd) / 255;
    const averageLevel = totalSum / bufferLength / 255;
    
    // Use time domain data as fallback if frequency data is weak
    const timeBasedLevel = rmsAmplitude / 128; // Normalize to 0-1
    const finalAverageLevel = Math.max(averageLevel, timeBasedLevel * 0.3);

    // Debug logging disabled to reduce console spam
    // To enable: set window.AUDIO_DEBUG = true in browser console
    if ((window as any).AUDIO_DEBUG && Date.now() % 500 < 16) {
      console.log('[AudioAnalyzer] Raw audio data:', {
        maxFreqValue,
        maxAmplitude,
        bassLevel: bassLevel.toFixed(3),
        midLevel: midLevel.toFixed(3),
        trebleLevel: trebleLevel.toFixed(3),
        averageLevel: averageLevel.toFixed(3)
      });
    }

    setAudioData({
      frequencyData: dataArray,
      bassLevel: Math.max(bassLevel, timeBasedLevel * 0.2), // Boost with time domain
      midLevel: Math.max(midLevel, timeBasedLevel * 0.3),
      trebleLevel: Math.max(trebleLevel, timeBasedLevel * 0.1),
      averageLevel: finalAverageLevel
    });

    // Continue analyzing if still enabled and listening
    if (enabledRef.current && isListeningRef.current) {
      animationRef.current = requestAnimationFrame(analyzeAudio);
    }
  }, []);

  const testMicrophone = useCallback(async () => {
    console.log('[AudioAnalyzer] Starting comprehensive microphone test...');
    
    try {
      // Test 1: Basic microphone access
      console.log('[Test 1] Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        } 
      });
      
      console.log('[Test 1] Success - Stream obtained:', {
        active: stream.active,
        tracks: stream.getTracks().map(t => ({
          kind: t.kind,
          enabled: t.enabled,
          muted: t.muted,
          readyState: t.readyState,
          settings: t.getSettings?.()
        }))
      });
      
      // Test 2: Audio Context creation
      console.log('[Test 2] Creating AudioContext...');
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const testContext = new AudioContextClass();
      
      console.log('[Test 2] AudioContext created:', {
        state: testContext.state,
        sampleRate: testContext.sampleRate,
        baseLatency: testContext.baseLatency
      });
      
      if (testContext.state === 'suspended') {
        console.log('[Test 2] Resuming suspended context...');
        await testContext.resume();
        console.log('[Test 2] Context resumed, new state:', testContext.state);
      }
      
      // Test 3: Analyzer setup
      console.log('[Test 3] Setting up analyzer...');
      const testAnalyzer = testContext.createAnalyser();
      const testGain = testContext.createGain();
      const testSource = testContext.createMediaStreamSource(stream);
      
      testGain.gain.value = 5.0; // Higher gain for testing
      testSource.connect(testGain);
      testGain.connect(testAnalyzer);
      
      testAnalyzer.fftSize = 2048;
      testAnalyzer.smoothingTimeConstant = 0.1; // Less smoothing for faster response
      
      console.log('[Test 3] Analyzer setup complete:', {
        fftSize: testAnalyzer.fftSize,
        frequencyBinCount: testAnalyzer.frequencyBinCount,
        smoothingTimeConstant: testAnalyzer.smoothingTimeConstant
      });
      
      // Test 4: Data capture test
      console.log('[Test 4] Testing data capture for 3 seconds...');
      const bufferLength = testAnalyzer.frequencyBinCount;
      const freqData = new Uint8Array(bufferLength);
      const timeData = new Uint8Array(bufferLength);
      const floatData = new Float32Array(bufferLength);
      
      let maxFreqValue = 0;
      let maxTimeVariation = 0;
      let minFloatValue = 0;
      
      for (let i = 0; i < 30; i++) { // Test for 3 seconds (30 * 100ms)
        // Get all types of data
        testAnalyzer.getByteFrequencyData(freqData);
        testAnalyzer.getByteTimeDomainData(timeData);
        testAnalyzer.getFloatFrequencyData(floatData);
        
        // Analyze data
        const currentMaxFreq = Math.max(...freqData);
        const timeMin = Math.min(...timeData);
        const timeMax = Math.max(...timeData);
        const timeVariation = timeMax - timeMin;
        const currentMinFloat = Math.min(...floatData.filter(v => v > -Infinity));
        
        maxFreqValue = Math.max(maxFreqValue, currentMaxFreq);
        maxTimeVariation = Math.max(maxTimeVariation, timeVariation);
        minFloatValue = Math.min(minFloatValue, currentMinFloat);
        
        // Log every 10th sample
        if (i % 10 === 0) {
          console.log(`[Test 4] Sample ${i}: freq_max=${currentMaxFreq}, time_var=${timeVariation}, float_min=${currentMinFloat.toFixed(1)}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log('[Test 4] Results after 3 seconds:', {
        maxFrequencyValue: maxFreqValue,
        maxTimeVariation: maxTimeVariation,
        minFloatValue: minFloatValue,
        verdict: maxFreqValue > 0 ? 'FREQUENCY DATA DETECTED' : 
                 maxTimeVariation > 5 ? 'TIME DOMAIN DATA DETECTED' :
                 'NO AUDIO DETECTED - CHECK MICROPHONE'
      });
      
      // Test 5: MediaRecorder test
      console.log('[Test 5] Testing MediaRecorder...');
      try {
        const recorder = new MediaRecorder(stream);
        const chunks: BlobPart[] = [];
        
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);
            console.log(`[Test 5] Audio chunk: ${event.data.size} bytes`);
          }
        };
        
        recorder.start(200); // 200ms chunks
        setTimeout(() => {
          recorder.stop();
          console.log(`[Test 5] MediaRecorder test complete: ${chunks.length} chunks, total size: ${chunks.reduce((sum, chunk) => sum + (chunk as Blob).size, 0)} bytes`);
        }, 1000);
      } catch (recorderError) {
        console.error('[Test 5] MediaRecorder failed:', recorderError);
      }
      
      // Cleanup
      setTimeout(() => {
        testContext.close();
        stream.getTracks().forEach(track => track.stop());
        console.log('[AudioAnalyzer] Test complete - cleaned up resources');
      }, 2000);
      
    } catch (testError) {
      console.error('[AudioAnalyzer] Microphone test failed:', testError);
    }
  }, []);
  
  const startListening = useCallback(async () => {
    try {
      setError(null);
      if ((window as any).AUDIO_DEBUG) console.log('[AudioAnalyzer] Requesting microphone access...');
      
      // Check if microphone is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone access is not supported in this browser');
      }
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        } 
      });
      
      if ((window as any).AUDIO_DEBUG) {
        console.log('[AudioAnalyzer] Microphone access granted:', {
          stream,
          tracks: stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled })),
          sampleRate: stream.getTracks()[0]?.getSettings?.()?.sampleRate
        });
      }
      streamRef.current = stream;

      // Create audio context and analyzer
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      
      // Resume audio context if it's suspended (required by many browsers)
      if ((window as any).AUDIO_DEBUG) {
        console.log('[AudioAnalyzer] AudioContext created:', {
          state: audioContext.state,
          sampleRate: audioContext.sampleRate,
          baseLatency: audioContext.baseLatency
        });
      }
      
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
        if ((window as any).AUDIO_DEBUG) console.log('[AudioAnalyzer] Audio context resumed, new state:', audioContext.state);
      }
      
      const analyzer = audioContext.createAnalyser();
      
      analyzer.fftSize = fftSize;
      analyzer.smoothingTimeConstant = smoothingTimeConstant;
      
      // Create source with gain amplification
      const source = audioContext.createMediaStreamSource(stream);
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 3.0; // Amplify microphone signal
      
      source.connect(gainNode);
      gainNode.connect(analyzer);
      
      if ((window as any).AUDIO_DEBUG) console.log('[AudioAnalyzer] Audio routing: Source -> Gain(3x) -> Analyzer');

      audioContextRef.current = audioContext;
      analyzerRef.current = analyzer;
      sourceRef.current = source;
      gainRef.current = gainNode;
      
      if ((window as any).AUDIO_DEBUG) {
        console.log('[AudioAnalyzer] Audio analysis setup complete:', {
          fftSize,
          smoothingTimeConstant,
          analyzer: {
            fftSize: analyzer.fftSize,
            frequencyBinCount: analyzer.frequencyBinCount,
            smoothingTimeConstant: analyzer.smoothingTimeConstant
          }
        });
      }
      setIsListening(true);
      
      // Start analyzing
      if ((window as any).AUDIO_DEBUG) console.log('[AudioAnalyzer] Starting analysis loop...');
      analyzeAudio();
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to access microphone';
      console.error('Audio access error:', err);
      setError(errorMessage);
      
      // Provide more specific error messages
      if (errorMessage.includes('Permission denied') || errorMessage.includes('NotAllowedError')) {
        setError('Microphone access denied. Please allow microphone access and try again.');
      } else if (errorMessage.includes('NotFoundError')) {
        setError('No microphone found. Please connect a microphone and try again.');
      } else if (errorMessage.includes('NotReadableError')) {
        setError('Microphone is being used by another application. Please close other apps and try again.');
      }
    }
  }, [analyzeAudio, fftSize, smoothingTimeConstant]);

  const stopListening = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    
    if (gainRef.current) {
      gainRef.current.disconnect();
      gainRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyzerRef.current = null;
    setIsListening(false);
    setError(null);
  }, []);

  useEffect(() => {
    if (enabled && !isListening) {
      startListening();
    } else if (!enabled && isListening) {
      stopListening();
    }
  }, [enabled, isListening, startListening, stopListening]);

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);
  
  // Add click handler to resume audio context
  useEffect(() => {
    const handleUserInteraction = async () => {
      if (audioContextRef.current?.state === 'suspended') {
        if ((window as any).AUDIO_DEBUG) console.log('[AudioAnalyzer] Resuming suspended audio context on user interaction...');
        await audioContextRef.current.resume();
        if ((window as any).AUDIO_DEBUG) console.log('[AudioAnalyzer] Audio context resumed, new state:', audioContextRef.current.state);
      }
    };
    
    document.addEventListener('click', handleUserInteraction);
    document.addEventListener('keydown', handleUserInteraction);
    
    return () => {
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
    };
  }, []);

  return {
    audioData,
    isListening,
    error,
    startListening,
    stopListening,
    testMicrophone
  };
};