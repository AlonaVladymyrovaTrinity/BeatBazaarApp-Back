const { app } = require('../src/expressServer');
const io = require('socket.io-client');
const { intervalId } = require('../src/models/Order');

let server;
const PORT = 8001;

beforeAll(async () => {
  server = await app.listen(PORT);
});

afterAll(async () => {
  clearInterval(intervalId); // Clear the interval after tests are finished
  server.close();
});

test('test:ping socket event', (done) => {
  // Socket.io client for sending a message
  const senderClient = io.connect(`http://localhost:${PORT}`, {
    transports: ['websocket'], // WebSocket transport
    forceNew: true, // Create a new connection
    reconnection: false, // Disable reconnection attempts
  });

  // Second Socket.io client for receiving a message
  const recipientClient = io.connect(`http://localhost:${PORT}`, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
  });

  const messageToSend = 'Hello, server!';

  // Wait for successful connection of the senderClient
  senderClient.once('connect', () => {
    // Emit a 'test:ping' event message to the server
    senderClient.emit('test:ping', messageToSend);
  });

  // Wait for successful connection of the recipientClient
  recipientClient.once('connect', () => {
    // Listen for the 'test:ping' event to receive a response message
    recipientClient.on('test:ping', (response) => {
      // Check if the received response matches the expected value
      expect(response).toBe(`user sent: ${messageToSend}`);

      // Disconnect both clients
      senderClient.disconnect();
      recipientClient.disconnect();

      // Small timeout before calling "done()" to give time for the disconnect event to fire
      done();
    });
  });
});