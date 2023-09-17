# Integration Testing Documentation: "Get User By Id" Endpoint

## Introduction

This documentation provides a step-by-step guide to creating integration tests for the "Get User By Id" endpoint in backend application.

_Jest_ - a popular Javascript testing framework. This is the library that will look for all the files named \*\*.test.js in the repo and run them. It also gives us a framework for defining test cases (describe, it blocks)

_Supertest_ - A popular library for testing HTTP backends, like an Express server

_MongoDb-Memory-Server_ - In order to make sure our tests don’t mess up our live production database, we can use this library to run mongodb in-memory locally, and have mongoose connect to that version of the db when running tests

## Steps to Create a Test

### Step 1: Setting Up package.json and Running Tests

This process covers environment setup, test writing, and the utilization of necessary libraries(these have already been installed in the repo):

> npm install jest supertest mongodb-memory-server

Add a script to run tests in the "scripts" section of your package.json:

```javascript
// package.json
"scripts": {
  "test": "jest"
},
```

Now you have a configured package.json with installed dependencies and a script to run tests using the command _npm test_.

### Step 2: Code Separation in the Application

Extract the code from `app.js` into a new file, such as `expressServer.js`.

```javascript
// expressServer.js
const express = require('express');
const app = express();

module.exports = { app, connectDB };
```

### Step 3: Start the Server

Now, in your `app.js` file, retain only the code necessary for launching the server.

```javascript
// app.js
const { app, connectDB } = require('./expressServer');
const logger = require('../logs/logger');

// Start the server
const port = process.env.PORT || 8000;
const start = async () => {
  try {
    await connectDB(process.env.MONGO_URL);
    app.listen(port, () => {
      logger.info(`Server running on http://localhost:${port}`);
    });
  } catch (error) {
    logger.error(error);
  }
};

start();
```

### Step 4: Test Setup

Create a new file specifically for your tests, such as `userController.test.js`. This file will house the integration tests for the "Get User By Id" endpoint.

```javascript
// userController.test.js
const { app, connectDB } = require('../src/expressServer.js');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const User = require('../src/models/User');
```

### Step 5: Environment Setup for Tests

Before running all your tests, you need to configure the testing environment. This step involves creating an in-memory MongoDB instance and starting the server to ensure a controlled environment for your integration tests.

In your `userController.test.js` file, set up the environment using the `beforeAll()` and `afterAll()` hooks provided by Jest:

```javascript
// userController.test.js
// Declare variables for the server, database connection, and in-memory MongoDB instance
let server;
let mongooseConnection;
let mongodb;

// set up the mongodb and the express server before starting the tests
beforeAll(async () => {
  // This will create a new instance of "MongoMemoryServer" and automatically start it
  mongodb = await MongoMemoryServer.create();
  const url = mongodb.getUri();
  // set the url so that our server's mongoose connects to the in-memory mongodb and not our real one
  process.env.MONGO_URL = url;
  mongooseConnection = await connectDB(url);
  server = await app.listen(8001);
});

afterAll(async () => {
  // turn off the server and mongo connections once all the tests are done
  await server.close();
  await mongooseConnection.disconnect();
  await mongodb.stop();
});
```

### Step 6: Writing Tests

Now that you've set up the environment, it's time to write the actual tests for the "Get User By Id" endpoint. In your `userController.test.js` file, create a test suite using the `describe()` function and add the test cases using the `it()` function:

```javascript
// userController.test.js
describe('GET /api/v1/users/:user_id endpoint', () => {
  it('should return a valid user without the password field if found', async () => {
    // Arrange: Create a test user
    const user = await User.create({
      name: 'ava',
      email: 'ava@ava.com',
      password: 'secret',
      role: 'user',
    });

    // Act: Log in and get a signed cookie
    const signedCookie = await loginAndReturnCookie(testUserCredentials);
    // Act: Get user information using the authenticated cookie
    const response = await request(app)
      .get(`/api/v1/users/${user.id}`)
      .set('Cookie', [signedCookie]);
    // Assert: Check the response status and user information
    expect(response.status).toBe(200); // Assertion: Expecting the response status to be 200 (successful request)
    expect(response.body).toHaveProperty('user'); // Assertion: Expecting the response body to have the property "user"
    // Assertion: Expecting the user properties (name, email, role) to match the specified values
    expect(response.body.user).toMatchObject({
      name: 'ava',
      email: 'ava@ava.com',
      role: 'user',
    });
    expect(response.body.user).not.toHaveProperty('password');
  });

  it('should return a 404 status if user is not found', async () => {
    // Arrange: Log in and get a signed cookie with valid test user credentials
    const signedCookie = await loginAndReturnCookie(testUserCredentials);
    // Act: Attempt to get user information using the authenticated cookie
    const response = await request(app)
      .get('/api/v1/users/nonexistentUserId') // Requesting the route to get information about a non-existent user
      .set('Cookie', [signedCookie]); // Setting the 'Cookie' HTTP header with a signed cookie for authentication
    // Assert: Check the response status for 404
    expect(response.status).toBe(404);
  });
});
```

## Testing Structure Using Jest

### Test Suites and Test Cases

In Jest, tests are organized into **test suites** and **test cases**. A test suite is created using the `describe()` function, and test cases are defined using the `it()` function.

In the provided example, the test suite is defined for the "/api/v1/users/:user_id endpoint". Within this suite, there are two test cases:

1. **Testing the Successful Retrieval of a Valid User:** This test case validates the response when a valid user is found. It includes the ARRANGE, ACT, and ASSERT sections.
2. **Testing the Response When a User is Not Found:** This test case verifies the response status when attempting to retrieve a user that doesn't exist. It also includes the ARRANGE, ACT, and ASSERT sections.

```javascript
describe('/api/v1/users/:user_id endpoint', () => {
  it('should return a valid user without the password field if found', async () => {
    // Test case 1: Arrange, Act, Assert
  });

  it('should return a 404 status if the user is not found', async () => {
    // Test case 2: Arrange, Act, Assert
  });
});
```

### The pattern for crafting effective tests - **ARRANGE-ACT-ASSERT:**

Effective tests typically adhere to the "ARRANGE-ACT-ASSERT" pattern, which entails:

- **ARRANGE:** Setting up data and configuring the environment before executing the test case.
- **ACT:** Executing the test case, which is the action you intend to assess.
- **ASSERT:** Verifying the test case's outcome to ensure it aligns with expectations.

This pattern enhances test structure and readability.

### Expect Assertions

In Jest, expectations (assertions) are defined using the `expect()` function. You can utilize various matchers provided by Jest to verify the conditions you expect in your tests. In the example, matchers such as `.toBe()`, `.toHaveProperty()`, `.toMatchObject()`, and `.not.toHaveProperty()` are used to validate the response data:

```javascript
expect(response.status).toBe(200);
expect(response.body).toHaveProperty('user');
expect(response.body.user).toMatchObject({
  /* expected user data */
});
expect(response.body.user).not.toHaveProperty('password');
```

### Additional Resources

For more in-depth insights into Jest, Supertest, MongoDb-Memory-Server, and best practices in testing, explore the following resources:

- [Jest Docs: Getting Started](https://jestjs.io/docs/getting-started)
- [Supertest: How to Test APIs Like a Pro](https://dev.to/nedsoft/testing-nodejs-express-api-with-jest-and-supertest-1km6)
- [MongoDb-Memory-Server Documentation](https://nodkz.github.io/mongodb-memory-server/docs/)
- [Jest Crash Course - Unit Testing in JavaScript](https://www.youtube.com/watch?v=7r4xVDI2vho)
- [Introduction To Testing In JavaScript With Jest](https://www.smashingmagazine.com/2020/06/practical-introduction-ux-jest/)
- [Testing Node Server with Jest and Supertest](https://mherman.org/blog/testing-node-js-with-jest-and-supertest/)
- [A PATTERN FOR WRITING GOOD TESTS](https://automationpanda.com/2020/07/07/arrange-act-assert-a-pattern-for-writing-good-tests/)

### Jest Documentation

For a deeper dive into Jest's capabilities, explore the following sections of the [Jest Documentation](https://jestjs.io/docs/):

- [Jest Matchers Documentation](https://jestjs.io/docs/expect)
- [Jest Global Object](https://jestjs.io/docs/api)
- [Jest CLI Options](https://jestjs.io/docs/cli)
- [Jest Configuration](https://jestjs.io/docs/configuration)
- [Jest Setup and Teardown](https://jestjs.io/docs/setup-teardown)
- [Jest Mock Functions](https://jestjs.io/docs/mock-functions)
- [Jest Asynchronous Tests](https://jestjs.io/docs/asynchronous)
- [Jest Snapshot Testing](https://jestjs.io/docs/snapshot-testing)
- [Jest Testing Framework Overview](https://jestjs.io/docs/testing-frameworks)