const assert = require('node:assert/strict');
const test = require('node:test');

const Onboarding = require('../service/onboarding');

test('serializes the completed profile for the JSON stored procedure', async () => {
  const service = Object.create(Onboarding.prototype);
  let output;
  let procedureArgs;

  Object.defineProperties(service, {
    app_db: {value: 'onboarding'},
    output: {value: {data: value => { output = value; }}},
    uid: {value: 'user-1'},
    user: {value: {get: () => ({email: 'alex@example.com'})}},
    yp: {
      value: {
        await_proc: async (...args) => { procedureArgs = args; },
        await_query: async () => ({
          firstname: 'Alex',
          industry: 'tech_software',
        }),
      },
    },
  });

  await service.update_profile();

  assert.deepEqual(procedureArgs.slice(0, 2), [
    'drumate_update_profile',
    'user-1',
  ]);
  assert.equal(typeof procedureArgs[2], 'string');
  assert.deepEqual(JSON.parse(procedureArgs[2]), {
    onboarded: 1,
    firstname: 'Alex',
    industry: 'tech_software',
  });
  assert.deepEqual(output, {
    onboarded: 1,
    firstname: 'Alex',
    industry: 'tech_software',
  });
});
