import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

export const useSocket = (
  conversationId: string
) => {
  const socketRef = useRef<ReturnType<typeof io> | null>(null);

  const [state, setState] = useState<{
    connected: boolean;
    error: string | null;
    conversationId: string;
    messages: any[];
  }>({ connected: false, error: null, conversationId, messages: [] });

  useEffect(() => {
    const socket = io("ws://localhost:3000", {
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Socket.IO connected to server");
      setState({ connected: true, error: null, conversationId, messages: [] });
    });

    socket.on("chat-event", (event) => {
      console.log("Chat event:", event);
      setState((prev) => ({ ...prev, messages: [...prev.messages, { type: "chat-event", ...event }] }));
    });

    socket.on("chat-response", (response) => {
      console.log("Chat response received:", response);
      setState((prev) => ({ ...prev, messages: [...prev.messages, { type: "chat-response", ...response }] }));
    });

    socket.on("connect_error", (error) => {
      console.error("Socket.IO connect_error:", error);
      setState({ connected: false, error: "Socket.IO connect_error", conversationId, messages: [] });
    });

    socket.on("error", (error) => {
      console.error("Socket.IO error:", error);
      setState({ connected: false, error: "Socket.IO error", conversationId, messages: [] });
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket.IO disconnected:", reason);
      setState({ connected: false, error: null, conversationId, messages: [] });
    });

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
    resetMessages: () => setState((prev) => ({ ...prev, messages: [] })),
    sendMessage: (message: string) => {
      const s = socketRef.current;
      if (!s || !state.connected) {
        console.warn("Socket.IO not connected. Dropping message.");
        return;
      }
      console.log(`Sending message (Socket.IO): ${message}`);
      s.emit(
        "chat-request",
        JSON.stringify({
          conversationId,
          requestId: crypto.randomUUID(),
          text: message,
        }),
        (res: any) => {
          console.log(`Message sent successfully: ${res}`);
        }
      );
    },
    closeConnection: () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    },
    messages: state.messages,
  };
};
