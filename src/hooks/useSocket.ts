import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

export const useSocket = (conversationId: string) => {
  const socketRef = useRef<ReturnType<typeof io> | null>(null);

  const [state, setState] = useState<{
    connected: boolean;
    error: string | null;
    conversationId: string;
    messages: any[];
  }>({ connected: false, error: null, conversationId, messages: [] });

  const sendMessage = (message: string) => {
    if (socketRef.current?.active === false) {
      console.warn("Socket.IO not connected. Dropping message.");
      return;
    }
    socketRef.current?.emit(
      "chat-request",
      {
        conversationId,
        requestId: crypto.randomUUID(),
        text: message,
      },
      (res: any) => {
        console.log(`Message sent successfully: ${res}`);
      }
    );
  };

  const popMessage = useCallback(async (): Promise<any | undefined> => {
    const msg = await new Promise<string | undefined>((resolve) => {
      setState((prev) => {
        const [first, ...rest] = prev.messages;
        resolve(first);
        return { ...prev, messages: rest };
      });
    });
    return msg;
  }, []);

  useEffect(() => {
    const socket = io("ws://localhost:3001", {
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Socket.IO connected to server");
      setState({
        connected: true,
        error: null,
        conversationId,
        messages: [],
      });
    });

    socket.on("chat-event", (event) => {
      if (event.event === "CHAT_END_EVENT") {
        return;
      }
    });

    socket.on("chat-response", (response) => {
      const res = {
        ...response,
        text: response.text ? response.text.replace(/^\s*\[[^\]]+\]\s*/g, "") : "",
      };
      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, { type: "chat-response", ...res }],
      }));
    });

    socket.on("connect_error", (error) => {
      console.error("Socket.IO connect_error:", error);
      setState({
        connected: false,
        error: "Socket.IO connect_error",
        conversationId,
        messages: state.messages,
      });
    });

    socket.on("error", (error) => {
      console.error("Socket.IO error:", error);
      setState({
        connected: false,
        error: "Socket.IO error",
        conversationId,
        messages: state.messages,
      });
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket.IO disconnected:", reason);
      setState({
        connected: false,
        error: null,
        conversationId,
        messages: state.messages,
      });
    });

    window.sendMessage = sendMessage;

    console.log("Socket.IO useEffect initialized");

    return () => {
      if (!socketRef.current) return;
      socketRef.current.off("connect");
      socketRef.current.off("chat-event");
      socketRef.current.off("chat-response");
      socketRef.current.off("connect_error");
      socketRef.current.off("error");
      socketRef.current.off("disconnect");
      socketRef.current.disconnect();
      socketRef.current = null;
    };
  }, []);

  return {
    isConnected: state.connected,
    error: state.error,
    resetMessages: () => {
      setState((prev) => ({ ...prev, messages: [] }));
    },
    sendMessage,
    popMessage,
    closeConnection: () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    },
    messages: state.messages,
  };
};
