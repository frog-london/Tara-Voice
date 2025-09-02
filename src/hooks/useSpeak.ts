import { useEffect, useRef, useState } from "react";

export const useSpeak = () => {
  const ref = useRef<SpeechSynthesisUtterance | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [currentMessage, setCurrentMessage] = useState<number | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const speak = (text: string) => {
    setMessages((prev) => [...prev, text]);

    if (currentMessage === null) {
      setCurrentMessage(0);
    }
  };


  useEffect(() => {
    const handleEnd = () => {
      ref.current = null;
    };

    const nextMessage = () => {
      if (currentMessage === messages.length - 1) {
        console.log("Finished speaking all messages");
        setIsSpeaking(false);
        return setCurrentMessage(null);
      }
      setCurrentMessage((prev) => (prev !== null ? prev + 1 : null));
    };

    ref.current = new SpeechSynthesisUtterance();
    ref.current.addEventListener("end", nextMessage);
    window.speechSynthesis.addEventListener("end", handleEnd);
    return () => {
      window.speechSynthesis.removeEventListener("end", handleEnd);
      ref.current?.removeEventListener("end", nextMessage);
    };
  }, []);

  useEffect(() => {
    console.log("Next message", currentMessage, messages.length);

    if (currentMessage !== null && messages[currentMessage]) {
      // get the current message
      ref.current!.text = messages[currentMessage];
      window.speechSynthesis.speak(ref.current!);
    }

    return () => {
      if (ref.current) {
        window.speechSynthesis.cancel();
      }
    };
  }, [currentMessage]);

  return { speak };
};
