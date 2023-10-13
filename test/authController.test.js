const { app, connectDB } = require('../src/expressServer.js');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const request = require('supertest');
const { intervalId: orderUpdateInterval } = require('../src/models/Order');
const User = require('../src/models/User');
const { loginAndReturnCookie } = require('./test_helper');
const sender = require('../src/mailing/sender');

// Declare variables for the server, database connection, and in-memory MongoDB instance
let server;
let mongooseConnection;
let mongodb;

// Credentials for test user
const testUserCredentials = {
  email: 'ava@ava.com',
  password: 'secret',
};

// Test user data
const testUserData = {
  name: 'ava',
  username: 'ava',
  email: 'ava@ava.com',
  password: 'secret',
  role: 'user',
};
console.log('Test User Data:', testUserData);
console.log('Test User Credentials:', testUserCredentials);

let testUser;
// set up the mongodb and the express server before starting the tests
beforeAll(async () => {
  mongodb = await MongoMemoryReplSet.create({
    replSet: { storageEngine: 'wiredTiger' },
  });
  const url = mongodb.getUri();
  // set the url so that our server's mongoose connects to the in-memory mongodb and not our real one
  process.env.MONGO_URL = url;
  mongooseConnection = await connectDB(url);
  server = await app.listen(8001);
});
beforeEach(async () => {
  testUser = await User.create(testUserData);
});
afterAll(async () => {
  // turn off the server and mongo connections once all the tests are done
  await server.close();
  await mongooseConnection.disconnect();
  await mongodb.stop();
  // turn off the order update interval so that jest can cleanly shutdown
  clearInterval(orderUpdateInterval);
});
afterEach(async () => {
  await User.deleteMany({});
  jest.restoreAllMocks();
}, 15000);

describe('Authentication API Endpoints', () => {
  // beforeEach(async () => {
  //   await User.create(testUser);
  // });
  it('should register a new user and log in', async () => {
    const emailSpy = jest.spyOn(sender, 'sendWelcomeEmail');
    // Arrange: Register a new user
    const registrationResponse = await request(app)
      .post('/api/v1/auth/register')
      .send(testUserData);

    // Assert: Check the response status and body
    expect(registrationResponse.status).toBe(201); // Expecting a successful registration
    expect(registrationResponse.body).toHaveProperty('user'); // Expecting a user object in the response
    const createdUser = await User.findOne({ email: testUserData.email });

    // Expecting the user to be saved in the database (not null)
    expect(createdUser).not.toBeNull();
    // Expect the user object in the response to match the user object in the database
    expect(registrationResponse.body.user).toMatchObject({
      email: createdUser.email,
      name: createdUser.name,
      role: createdUser.role,
      userId: createdUser.id,
    });
    expect(emailSpy).toHaveBeenCalledTimes(1); // Expecting the sendWelcomeEmail function to be called once
    expect(emailSpy).toHaveBeenCalledWith(
      testUser.email,
      expect.objectContaining({ name: createdUser.name })
    ); // Expecting the sendWelcomeEmail function to be called with the correct email address and a user object that has the expected name

    // Act: Log in with the newly registered user's credentials
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send(testUserCredentials);

    // Assert: Check the response status and body
    expect(loginResponse.status).toBe(201); // Expecting a successful login
    expect(loginResponse.body).toHaveProperty('user'); // Expecting a user object in the response
    // Further assertions on the shape of the user object in the response
    const userInResponse = loginResponse.body.user;
    expect(userInResponse).toHaveProperty('email');
    expect(userInResponse).toHaveProperty('name');
    expect(userInResponse).toHaveProperty('role');
    expect(userInResponse).toHaveProperty('userId');
  });

  it('should log out the user', async () => {
    // Log in the test user to obtain a valid cookie
    const signedCookie = await loginAndReturnCookie(testUserCredentials);

    // Make a request to the logout endpoint with the cookie
    const logoutResponse = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', [signedCookie]);

    // Assert: Check the response status and body
    expect(logoutResponse.status).toBe(200); // Expecting a successful logout
    expect(logoutResponse.body).toEqual({ msg: 'user logged out!' }); // Expecting the specified message in the response
  });

  it('should send a password reset email', async () => {
    // Make a request to the forgot password endpoint with the user's email
    const forgotPasswordResponse = await request(app)
      .post('/api/v1/auth/forgot_password')
      .send({ email: testUser.email }); // Use the email of the test user

    expect(forgotPasswordResponse.status).toBe(200);
    expect(forgotPasswordResponse.body).toEqual({
      message: 'Password reset email sent',
    });
  });
});
