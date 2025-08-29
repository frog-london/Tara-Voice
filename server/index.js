const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();

// CORS configuration for HTTP endpoints (no external dependency)
const DEFAULT_CLIENT_ORIGIN = 'http://localhost:5173';
const allowedOrigins = (process.env.CLIENT_ORIGINS || DEFAULT_CLIENT_ORIGIN)
  .split(',')
  .map((s) => s.trim());

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (allowedOrigins.includes('*') || allowedOrigins.includes(origin))) {
    res.header('Access-Control-Allow-Origin', origin);
  } else if (allowedOrigins.includes('*')) {
    res.header('Access-Control-Allow-Origin', '*');
  }
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', allowedOrigins, port: process.env.SERVER_PORT || 3000 });
});

const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ["websocket"],
    pingInterval: 25000, // default 25000, keep explicit
    pingTimeout: 60000,  // allow slower networks
    allowEIO3: true      // compatibility with older clients
});

const port = process.env.SERVER_PORT || 3000;

io.on('connection', (socket) => {
    console.log('Client connected');

    socket.on('chat-request', (data) => {
        console.log('Received chat-request:', data);

        // Parse the data if it's a string
        if (typeof data === 'string') {
            try {
                data = JSON.parse(data);
            } catch (e) {
                console.error('Failed to parse incoming data:', e);
                return;
            }
        }

        const { conversationId, requestId, text } = data;

        if (typeof text !== 'string' || text.trim() === '') {
            console.error('Invalid chat-request: missing or invalid text field');
            return;
        }

        let responses = [];
        const lowerText = text.toLowerCase();

        if (lowerText.includes('hello')) {
            responses = [
                { text: "Hello there, how are you today?" }
            ];
        } else if (lowerText.includes('bye')) {
            responses = [
                { text: "[Happy] It was great talking to you." },
                { text: "  Take care!" }
            ];
        } else if (lowerText.includes('job')) {
            responses = [
                { text: "[Thoughtful] It's a hard question to answer, because I've been doing this for so long now." },
                { text: "[Neutral] I suppose like any job, there can be some stressful periods." },
                { text: "[Serious]  Dealing with those can be tough, especially when it affects the crew." },
                { text: "[Neutral] But I'd say those are just part of the job." },
                { text: "The good days definitely outweigh the bad." }
            ];
        } else if (lowerText.includes('food')) {
            responses = [
                { text: "[Happy]  Ah, the food on a submarine!" },
                { text: "It's definitely changed since I first joined." },
                { text: "We make our own food, which means it's cooked fresh, and we've got a good team in the galley." },
                { text: "[Neutral] We try to keep things as varied as possible, but you're right, space is limited." },
                { text: "[Curious] You'd be surprised what they can cook up in a small galley, though!" },
                { text: "We do have traditions, like fish and chips on Fridays, pizza on Sundays, those are always a hit." },
                { text: "[Neutral]  It's all about keeping morale up, I suppose." },
                { text: "We also have a lot of dehydrated and pre-prepared meals, which are good for quick snacks or when things are busy." },
                { text: "[Thoughtful] It's not always gourmet dining, but it's definitely good enough to keep you going." }
            ];
        } else if (lowerText.includes('sleep')) {
            responses = [
                { text: "[Thoughtful]  Sleeping on a submarine is." },
                { text: "different." },
                { text: "[Neutral] You're right, it's not like a normal bed back home." },
                { text: "We have bunks, which are basically just metal beds." },
                { text: "[Serious] You get used to it, but it's not the most comfortable thing in the world." },
                { text: "[Happy] You do learn to sleep through a lot of things though, like the hum of the engines and the creaking of the boat." },
                { text: "[Neutral]  It's definitely a unique experience." }
            ];
        } else {
            responses = [
                { text: "[Sad] I'm sorry, I don't know how to answer that." },
                { text: "[Curious] Would you like to ask me another question?" }
            ];
        }

        // Emit chat start event
        const chatStartEvent = {
            conversationId,
            responseId: requestId,
            event: 'CHAT_START_EVENT'
        };
        console.log('Sending chat-event:', chatStartEvent);
        socket.emit('chat-event', chatStartEvent);

        // Emit each response
        let responseIndex = 0;
        const interval = setInterval(() => {
            if (responseIndex < responses.length) {
                const response = responses[responseIndex];
                const chatResponse = {
                    conversationId,
                    responseId: requestId,
                    responseIndex: response.text.length,
                    text: response.text
                };
                console.log('Sending chat-response:', chatResponse);
                socket.emit('chat-response', chatResponse);
                responseIndex++;
            } else {
                // Emit chat end event
                const chatEndEvent = {
                    conversationId,
                    responseId: requestId,
                    event: 'CHAT_END_EVENT'
                };
                console.log('Sending chat-event:', chatEndEvent);
                socket.emit('chat-event', chatEndEvent);
                clearInterval(interval);
            }
        }, 1000); // Adjust delay as needed
    });

    socket.on('chat-summary-request', (data) => {
        console.log('Received chat-summary-request:', data);

        const summaryResponse = {
            conversationId: data.conversationId,
            text: [
                { title: "Topic 1", summary: "A brief summary of the theme of Topic 1." },
                { title: "Topic 2", summary: "A brief summary of the theme of Topic 2." },
                { title: "Topic 3", summary: "A brief summary of the theme of Topic 3." },
                { title: "Topic 4", summary: "A brief summary of the theme of Topic 4." }
            ]
        };

        console.log('Sending chat-summary-response:', summaryResponse);
        socket.emit('chat-summary-response', summaryResponse);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

server.on('error', (err) => {
    console.error('Server error:', err);
});

server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});



