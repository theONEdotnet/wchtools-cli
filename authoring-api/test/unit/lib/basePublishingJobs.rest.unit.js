/*
Copyright 2016 IBM Corporation

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
/**
 * Unit tests for the REST object.
 */
"use strict";

// Require the super classes for this class.
const UnitTest = require("./base.unit.js");
const BaseRestUnitTest = require("./base.rest.unit.js");

// Require the node modules used in this test file.
const fs = require("fs");
const stream = require("stream");
const diff = require("diff");
const sinon = require("sinon");
const options = require(UnitTest.API_PATH + "lib/utils/options.js");

// Require the local modules that will be stubbed, mocked, and spied.
const utils = require(UnitTest.API_PATH + "lib/utils/utils.js");
const request = utils.getRequestWrapper();

class BasePublishingJobsRestUnitTest extends BaseRestUnitTest {
    constructor() {
        super();
    }

    run (restApi, lookupUri,restName,itemPath1,itemPath2) {
        const self = this;
        describe("Unit tests for Rest " + restName, function() {
            // Initialize common resources before running the unit tests.
            before(function (done) {
                // Reset the state of the REST API.
                restApi.reset();

                // Signal that the cleanup is complete.
                done();
            });

            // Cleanup common resources consumed by a test.
            afterEach(function (done) {
                // Restore any stubs and spies used for the test.
                self.restoreTestDoubles();

                // Reset the state of the REST API.
                restApi.reset();

                // Signal that the cleanup is complete.
                done();
            });

            // Run each of the tests defined in this class.
            self.testSingleton(restApi, lookupUri,restName,itemPath1,itemPath2);
            self.testGetPublishingJobs(restApi, lookupUri,restName,itemPath1,itemPath2);
            self.testGetPublishingJob(restApi, lookupUri,restName,itemPath1,itemPath2);
            self.testGetPublishingJobStatus(restApi, lookupUri,restName,itemPath1,itemPath2);
            self.testCreatePublishingJob(restApi, lookupUri,restName,itemPath1,itemPath2);
            self.testDeletePublishingJob(restApi, lookupUri,restName,itemPath1,itemPath2);
            self.testCancelPublishingJob(restApi, lookupUri,restName,itemPath1,itemPath2);
        });
    }

    testSingleton (restApi, lookupUri,restName,itemPath1,itemPath2) {
        describe("is a singleton", function () {
            it("should fail if try to create a rest Type", function (done) {
                let error;
                try{
                    let foo = new restApi.constructor();
                    error = "shouldn't get here";
                }
                catch (e){
                    expect(e).to.equal("An instance of singleton class " + restApi.constructor.name + " cannot be constructed");
                }
                // Call mocha's done function to indicate that the test is over.
                done(error);
            });
        });
    }

    testGetPublishingJobs (restApi, lookupUri,restName,itemPath1,itemPath2) {
        const self = this;

        // Execute several failure cases to test the various ways the server might return an error. Subsequent tests do
        // not need to repeat the test matrix, they can just execute one of these tests to verify an error is returned.
        describe("getPublishingJobs", function() {
            it("should fail when getting items the fails with an error", function (done) {
                // Create a stub for the GET requests.
                const stub = sinon.stub(request, "get");
                // The second GET request is to retrieve the items, but returns an error.
                const URI_ERROR = "Error getting the items.";
                let err = new Error(URI_ERROR);
                let res = null;
                let body = null;
                stub.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                restApi.getPublishingJobs(UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the request URI should have been rejected.");
                    })
                    .catch (function (err) {
                        try {
                            // Verify that the stub was called once with the lookup URI and once with the URI.
                            expect(stub).to.have.been.calledOnce;
                            expect(stub.firstCall.args[0].json).to.equal(true);

                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.equal(URI_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should fail when getting the items fails with an error response code", function (done) {
                // Create a stub for the GET requests.
                const stub = sinon.stub(request, "get");
                // The second GET request is to retrieve the items, but returns an error.
                const URI_ERROR = "Error getting the items.";
                let err = null;
                let res = {"statusCode": 407};
                let body = URI_ERROR;
                stub.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                restApi.getPublishingJobs(UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the request URI should have been rejected.");
                    })
                    .catch (function (err) {
                        try {
                            // Verify that the stub was called once with the lookup URI and once with the URI.
                            expect(stub).to.have.been.calledOnce;
                            expect(stub.firstCall.args[0].uri).to.contain("http");
                            expect(stub.firstCall.args[0].json).to.equal(true);

                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.equal(URI_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when getting valid items", function (done) {
                // Create a stub for GET requests
                const stub = sinon.stub(request, "get");
                // The second GET request is to retrieve the items metadata.
                const item1 = UnitTest.getJsonObject(itemPath1);
                const item2 = UnitTest.getJsonObject(itemPath2);
                let err = null;
                let res = {"statusCode": 200};
                let body = {"items": [item1, item2]};
                stub.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                restApi.getPublishingJobs(UnitTest.DUMMY_OPTIONS)
                    .then(function (items) {
                        // Verify that the stub was called twice, first with the lookup URI and then with the URI.
                        expect(stub).to.have.been.calledOnce;
                        expect(stub.firstCall.args[0].uri).to.contain("http")
                        expect(stub.firstCall.args[0].json).to.equal(true);

                        // Verify that the REST API returned the expected values.
                        expect(diff.diffJson(item1, items[0])).to.have.lengthOf(1);
                        expect(diff.diffJson(item2, items[1])).to.have.lengthOf(1);
                    })
                    .catch (function (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }

    testGetPublishingJob (restApi, lookupUri,restName,itemPath1,itemPath2) {
        const self = this;
        describe("getPublishingJob", function() {
            it("should fail when the specified item does not exist", function (done) {
                const CANNOTFIND_ERROR = "cannot find item.";
                const stub = sinon.stub(request, "get");

                let err = new Error(CANNOTFIND_ERROR);
                let res = {"statusCode": 404};
                let body = null;
                stub.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                restApi.getPublishingJob(UnitTest.DUMMY_ID, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the item should have been rejected.");
                    })
                    .catch (function (err) {
                        try {
                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.contain(CANNOTFIND_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when getting a valid resource", function (done) {
                const stub = sinon.stub(request, "get");
                let err = null;
                let res = {"statusCode": 200};

                // Read the contents of a test file.
                const item =  UnitTest.getJsonObject(itemPath1);
                let body = item;
                stub.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                restApi.getPublishingJob(item.id, UnitTest.DUMMY_OPTIONS)
                    .then(function (rContent) {
                        // Verify that the item stub was called once with the expected value.
                        expect(stub).to.have.been.calledOnce;

                        // Verify that the REST API returned the expected value.
                        expect(diff.diffJson(item, rContent)).to.have.lengthOf(1);
                    })
                    .catch (function (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }


    testGetPublishingJobStatus (restApi, lookupUri,restName,itemPath1,itemPath2) {
        const self = this;
        describe("getPublishingJobStatus", function() {
            it("should fail when the specified item does not exist", function (done) {
                const CANNOTFIND_ERROR = "cannot find item.";
                const stub = sinon.stub(request, "get");

                let err = new Error(CANNOTFIND_ERROR);
                let res = {"statusCode": 404};
                let body = null;
                stub.onCall(0).yields(err, res, body);
                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);
                // Call the method being tested.
                let error;
                restApi.getPublishingJobStatus(UnitTest.DUMMY_ID, UnitTest.DUMMY_OPTIONS)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the item should have been rejected.");
                    })
                    .catch (function (err) {
                        try {
                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.contain(CANNOTFIND_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when getting a valid publishing job status", function (done) {
                const stub = sinon.stub(request, "get");
                let err = null;
                let res = {"statusCode": 200};

                // Read the contents of a test file.
                const item =  UnitTest.getJsonObject(itemPath1);
                let body = item;
                stub.onCall(0).yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stub);

                // Call the method being tested.
                let error;
                restApi.getPublishingJobStatus(item.id, UnitTest.DUMMY_OPTIONS)
                    .then(function (rContent) {
                        // Verify that the item stub was called once with the expected value.
                        expect(stub).to.have.been.calledOnce;

                        // Verify that the REST API returned the expected value.
                        expect(diff.diffJson(item, rContent)).to.have.lengthOf(1);
                    })
                    .catch (function (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }

    testCreatePublishingJob (restApi, lookupUri,restName,itemPath1,itemPath2) {
        const self = this;
        describe("createPublishingJob", function() {
            it("should fail when creating the item fails", function (done) {
                // Create a stub for the DELETE request which returns an error.
                const _ERROR = "Error creating the item.";
                const stubCreate = sinon.stub(request, "post");
                let err = new Error(_ERROR);
                let res = {"statusCode": 401};
                let body = null;
                stubCreate.yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stubCreate);

                // Call the method being tested.
                let error;
                restApi.createPublishingJob({})
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the item should have been rejected.");
                    })
                    .catch (function (err) {
                        try {
                            // Verify that the delete stub was called once with a URI that contains the specified ID.
                            expect(stubCreate).to.have.been.calledOnce;
                            expect(stubCreate.firstCall.args[0].uri).to.contain("jobs");

                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.contain(_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when creating a valid item specifies a body message", function (done) {
                // Create a stub for the DELETE request to delete the specified item.
                const stubCreate = sinon.stub(request, "post");
                let err = null;
                let res = {"statusCode": 201};
                let body = "{\"id\", \"123456\"}";
                stubCreate.yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stubCreate);

                // Call the method being tested.
                let error;
                restApi.createPublishingJob({})
                    .then(function (message) {
                        // Verify that the delete stub was called once with a URI that contains the specified ID.
                        expect(stubCreate).to.have.been.calledOnce;
                        expect(stubCreate.firstCall.args[0].uri).to.contain("jobs");

                    })
                    .catch (function (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }

    testDeletePublishingJob (restApi, lookupUri,restName,itemPath1,itemPath2) {
        const self = this;
        describe("deletePublishingJob", function() {
            it("should fail when deleting the item fails", function (done) {
                // Create a stub for the DELETE request which returns an error.
                const _ERROR = "Error deleting the item.";
                const stubDelete = sinon.stub(request, "del");
                let err = new Error(_ERROR);
                let res = {"statusCode": 403};
                let body = null;
                stubDelete.yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stubDelete);

                // Call the method being tested.
                let error;
                restApi.deletePublishingJob(UnitTest.DUMMY_ID)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the item should have been rejected.");
                    })
                    .catch (function (err) {
                        try {
                            // Verify that the delete stub was called once with a URI that contains the specified ID.
                            expect(stubDelete).to.have.been.calledOnce;
                            expect(stubDelete.firstCall.args[0].uri).to.contain(UnitTest.DUMMY_ID);

                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.contain(_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when deleting a valid item specifies a body message", function (done) {
                // Create a stub for the DELETE request to delete the specified item.
                const DELETE_MESSAGE = "The item was deleted.";
                const stubDelete = sinon.stub(request, "del");
                let err = null;
                let res = {"statusCode": 200};
                let body = DELETE_MESSAGE;
                stubDelete.yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stubDelete);

                // Call the method being tested.
                let error;
                restApi.deletePublishingJob(UnitTest.DUMMY_ID)
                    .then(function (message) {
                        // Verify that the delete stub was called once with a URI that contains the specified ID.
                        expect(stubDelete).to.have.been.calledOnce;
                        expect(stubDelete.firstCall.args[0].uri).to.contain(UnitTest.DUMMY_ID);

                        // Verify that the REST API returned the expected value.
                        expect(message).to.equal(DELETE_MESSAGE);
                    })
                    .catch (function (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when deleting a valid item specifies no body message", function (done) {
                // Create a stub for the DELETE request to delete the specified item.
                const stubDelete = sinon.stub(request, "del");
                let err = null;
                let res = {"statusCode": 204};
                let body = null;
                stubDelete.yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stubDelete);

                // Call the method being tested.
                let error;
                restApi.deletePublishingJob(UnitTest.DUMMY_ID)
                    .then(function (message) {
                        // Verify that the delete stub was called once with a URI that contains the specified ID.
                        expect(stubDelete).to.have.been.calledOnce;
                        expect(stubDelete.firstCall.args[0].uri).to.contain(UnitTest.DUMMY_ID);

                        // Verify that the REST API returned the expected value.
//                        expect(message).to.contain(UnitTest.DUMMY_ID);
                    })
                    .catch (function (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }

    testCancelPublishingJob (restApi, lookupUri,restName,itemPath1,itemPath2) {
        const self = this;
        describe("cancelPublishingJob", function() {
            it("should fail when cancelling the item fails", function (done) {
                // Create a stub for the DELETE request which returns an error.
                const _ERROR = "Error cancelling the item.";
                const stubDelete = sinon.stub(request, "put");
                let err = new Error(_ERROR);
                let res = {"statusCode": 403};
                let body = null;
                stubDelete.yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stubDelete);

                // Call the method being tested.
                let error;
                restApi.cancelPublishingJob(UnitTest.DUMMY_ID)
                    .then(function () {
                        // This is not expected. Pass the error to the "done" function to indicate a failed test.
                        error = new Error("The promise for the item should have been rejected.");
                    })
                    .catch (function (err) {
                        try {
                            // Verify that the delete stub was called once with a URI that contains the specified ID.
                            expect(stubDelete).to.have.been.calledOnce;
                            expect(stubDelete.firstCall.args[0].uri).to.contain(UnitTest.DUMMY_ID);

                            // Verify that the expected error is returned.
                            expect(err.name).to.equal("Error");
                            expect(err.message).to.contain(_ERROR);
                        } catch (err) {
                            error = err;
                        }
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when cancelling a valid item specifies a body message", function (done) {
                // Create a stub for the DELETE request to delete the specified item.
                const DELETE_MESSAGE = "The item was deleted.";
                const stubDelete = sinon.stub(request, "put");
                let err = null;
                let res = {"statusCode": 200};
                let body = DELETE_MESSAGE;
                stubDelete.yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stubDelete);

                // Call the method being tested.
                let error;
                restApi.cancelPublishingJob(UnitTest.DUMMY_ID)
                    .then(function (message) {
                        // Verify that the delete stub was called once with a URI that contains the specified ID.
                        expect(stubDelete).to.have.been.calledOnce;
                        expect(stubDelete.firstCall.args[0].uri).to.contain(UnitTest.DUMMY_ID);

                        // Verify that the REST API returned the expected value.
                        expect(message).to.equal(DELETE_MESSAGE);
                    })
                    .catch (function (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });

            it("should succeed when cancelling a valid item specifies no body message", function (done) {
                // Create a stub for the DELETE request to delete the specified item.
                const stubDelete = sinon.stub(request, "put");
                let err = null;
                let res = {"statusCode": 204};
                let body = null;
                stubDelete.yields(err, res, body);

                // The stub should be restored when the test is complete.
                self.addTestDouble(stubDelete);

                // Call the method being tested.
                let error;
                restApi.cancelPublishingJob(UnitTest.DUMMY_ID)
                    .then(function (message) {
                        // Verify that the delete stub was called once with a URI that contains the specified ID.
                        expect(stubDelete).to.have.been.calledOnce;
                        expect(stubDelete.firstCall.args[0].uri).to.contain(UnitTest.DUMMY_ID);
                    })
                    .catch (function (err) {
                        // NOTE: A failed expectation from above will be handled here.
                        // Pass the error to the "done" function to indicate a failed test.
                        error = err;
                    })
                    .finally(function () {
                        // Call mocha's done function to indicate that the test is over.
                        done(error);
                    });
            });
        });
    }

}

module.exports = BasePublishingJobsRestUnitTest;
