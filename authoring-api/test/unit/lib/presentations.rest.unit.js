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
 * Unit tests for the PresentationsREST object.
 */
"use strict";

// Require the super classes for this class.
const UnitTest = require("./base.unit.js");
const PresentationsUnitTest = require("./presentations.unit.js");
const BaseRestUnit = require("./base.rest.unit.js");

// Require the local module being tested.
const restApi = require(UnitTest.AUTHORING_API_PATH + "lib/presentationsREST.js").instance;
const options = require(UnitTest.AUTHORING_API_PATH + "lib/utils/options.js");
// Get the "lookup" URI for presentations.
const lookupUri =  options.getProperty("presentations", "uri");
const path1 = PresentationsUnitTest.VALID_PRESENTATIONS_DIRECTORY + PresentationsUnitTest.VALID_PRESENTATION_1;
const path2 = PresentationsUnitTest.VALID_PRESENTATIONS_DIRECTORY + PresentationsUnitTest.VALID_PRESENTATION_2;

class PresentationsRestUnitTest extends BaseRestUnit {
    constructor() {
        super();
    }
    run(){
        super.run(restApi, lookupUri, "presentations", path1, path2);
    }
}

module.exports = PresentationsRestUnitTest;