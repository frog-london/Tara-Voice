import { useCallback, useEffect, useRef, useState } from "react";

export function useSpeak(
  messages: string[],
  popMessage: () => Promise<any | undefined>
) {
  const speakingRef = useRef(false);

  const [currentMessage, setCurrentMessage] = useState<string | null>(null);

  const speak = useCallback((text: string) => {
    return new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => {
        setCurrentMessage(null);
        resolve();
      };
      utterance.onboundary = () => {
        setCurrentMessage(text);
      };
      speechSynthesis.speak(utterance);
    });
  }, []);

  useEffect(() => {
    if (!speakingRef.current && messages.length > 0) {
      (async () => {
        popMessage().then((msg) => {
          if (msg) {
            speak(msg.text.replace(/^\s*\[[^\]]+\]\s*/g, ""));
          }
        });
      })();
    }
  }, [messages, popMessage, speak]);

  return { currentMessage };
}
