"use strict";
const { createFileCredentialProvider, retrieveInitialCredential, promptPassword } = require("./credentials");
module.exports = { ...require("./enrollment"), createFileCredentialProvider, retrieveInitialCredential, promptPassword, OperatorBootstrapError: require("./errors").OperatorBootstrapError };
