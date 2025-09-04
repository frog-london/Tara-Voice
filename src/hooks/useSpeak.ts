import { useCallback, useEffect, useRef, useState } from "react";

export function useSpeak(
  messages: string[],
  popMessage: () => Promise<any | undefined>,
  onSpeechComplete?: () => void
) {
  const speakingRef = useRef(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentMessage, setCurrentMessage] = useState<string | null>(null);

  const speak = useCallback((text: string) => {
    return new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      
      utterance.onstart = () => {
        setIsSpeaking(true);
        setCurrentMessage(text);
      };
      
      utterance.onend = () => {
        setCurrentMessage(null);
        setIsSpeaking(false);
        resolve();
      };
      
      utterance.onerror = () => {
        setCurrentMessage(null);
        setIsSpeaking(false);
        resolve();
      };
      
      speechSynthesis.speak(utterance);
    });
  }, []);

  const processMessages = useCallback(async () => {
    if (speakingRef.current || messages.length === 0) {
      return;
    }
    
    console.log('Starting to process messages:', messages.length);
    speakingRef.current = true;
    
    try {
      // Process messages one by one
      let messageCount = 0;
      while (messages.length > 0 && messageCount < 10) { // Safety limit
        messageCount++;
        const msg = await popMessage();
        console.log('Processing message', messageCount, ':', msg);
        
        if (msg && msg.text) {
          const cleanText = msg.text.replace(/^\s*\[[^\]]+\]\s*/g, "");
          if (cleanText.trim()) {
            console.log('Speaking text:', cleanText);
            await speak(cleanText);
            console.log('Finished speaking message', messageCount);
          }
        }
        
        // Small delay between messages
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log('Finished processing all messages');
    } catch (error) {
      console.error('Error processing messages:', error);
    } finally {
      speakingRef.current = false;
      setIsSpeaking(false);
      console.log('All speech completed, calling onSpeechComplete');
      
      // Notify parent component that all speech is complete
      if (onSpeechComplete) {
        console.log('Calling onSpeechComplete callback');
        onSpeechComplete();
      } else {
        console.log('No onSpeechComplete callback provided');
      }
    }
  }, [messages, popMessage, speak, onSpeechComplete]);

  useEffect(() => {
    processMessages();
  }, [processMessages]);

  return { 
    currentMessage, 
    isSpeaking: isSpeaking || speakingRef.current,
    hasMessages: messages.length > 0
  };
}
