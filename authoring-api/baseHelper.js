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
"use strict";

const events = require("events");
const Q = require("q");
const fs = require("fs");
const options = require("./lib/utils/options.js");
const StatusTracker = require("./lib/utils/statusTracker.js");
const utils = require("./lib/utils/utils.js");
const logger = utils.getLogger(utils.apisLog);
const hashes = require("./lib/utils/hashes.js");
const i18n = utils.getI18N(__dirname, ".json", "en");

/**
 * Base class for API helper objects.
 *
 * Note: A helper object provides access to both the REST API and the local file system for a single artifact type.
 *
 * @class BaseHelper
 */
class BaseHelper {
    /**
     * The base constructor for a helper object.
     *
     * @constructs BaseHelper
     *
     * @param {BaseREST} restApi - The REST API object managed by this helper.
     * @param {BaseFS} fsApi - The FS object managed by this helper.
     * @param {String} artifactName - The name of the "artifact type" managed by this helper.
     */
    constructor (restApi, fsApi, artifactName) {
        /**
         * @member {BaseREST} _restApi - The REST API object managed by this helper.
         */
        this._restApi = restApi;

        /**
         * @member {BaseFS} _fsApi - The FS object managed by this helper.
         */
        this._fsApi = fsApi;

        /**
         * @member {String} _artifactName - The name of the "artifact type" managed by this helper.
         */
        this._artifactName = artifactName;

        /**
         * @member {StatusTracker} _statusTracker - The object used to track the status of artifacts for this helper.
         */
        this._statusTracker = new StatusTracker();

        /**
         * @member {events.EventEmitter} _eventEmitter - The object used to emit events for this helper.
         */
        this._eventEmitter = new events.EventEmitter();

        /**
         * @member {String} NEW - State flag indicating that an item is new.
         */
        this.NEW = hashes.NEW;

        /**
         * @member {String} MODIFIED - State flag indicating that an item has been modified.
         */
        this.MODIFIED = hashes.MODIFIED;

        /**
         * @member {String} DELETED - State flag indicating that an item has been deleted.
         */
        this.DELETED = hashes.DELETED;
    }

    /**
     * Set the options to be used as global options for this helper.
     *
     * Note: This method should only be called from the wchToolsApi getter for this helper.
     *
     * @param {Object} opts - The options to be used as global options for this helper.
     */
    initGlobalOptions (opts) {
        if (opts) {
            options.setGlobalOptions(opts);
        }
    }

    /**
     * Get the event emitter associated with this helper.
     *
     * @returns {Object} The event emitter associated with this helper.
     */
    getEventEmitter () {
        return this._eventEmitter;
    }

    /**
     * Get the name of the virtual folder used by this helper.
     *
     * @returns {String} The name of the virtual folder used by this helper.
     */
    getVirtualFolderName (opts) {
        // The "noVirtualFolder" option can be used to store artifacts directly in the specified working folder.
        if (opts && opts.noVirtualFolder) {
            return "";
        }
        return this._fsApi.getFolderName();
    }

    /**
     * Determines if the artifact directory exists locally.
     *
     * @returns {boolean}
     */
    doesDirectoryExist(opts) {
        const dir = this._fsApi.getPath(opts);
        return fs.existsSync(dir);
    }

    /**
     * Get the name to be displayed for the given item.
     *
     * @param {Object} item - The item for which to get the name.
     *
     * @returns {String} The name to be displayed for the given item.
     */
    getName (item) {
        // Display the ID of the artifact, or the name if the ID doesn't exist.
        if (item.id) {
            return item.id;
        }
        return item.name;
    }

    /**
     * Get the item on the local file system with the given name.
     *
     * @param {String} name - The name of the item.
     * @param {Object} opts - The options to be used to get the item.
     *
     * @returns {Q.Promise} A promise to get the item on the local file system with the given name.
     *
     * @resolves {Object} The item on the local file system with the given name.
     */
    getLocalItem (name, opts) {
        const helper = this;

        // Return the FS object's promise to get the local item with the given name.
        return this._fsApi.getItem(name, opts)
            .then(function (item) {
                // Keep track of the item's local status.
                return helper._addLocalStatus(item);
            });
    }

    /**
     * Get the items on the local file system.
     *
     * @param {Object} opts - The options to be used to get the items.
     *
     * @returns {Q.Promise} A promise to get the items on the local file system.
     *
     * @resolves {Array} The items on the local file system.
     */
    getLocalItems (opts) {
        const helper = this;

        // Return the FS object's promise to get the local items.
        return this._fsApi.getItems(opts)
            .then(function (items) {
                // Keep track of each item's local status.
                items.forEach(function (item) {
                    helper._addLocalStatus(item);
                });
                return items;
            });
    }

    /**
     * Get the items on the remote content hub.
     *
     * @param {Object} opts - The options to be used to get the items.
     *
     * @returns {Q.Promise} A promise to get the items on the remote content hub.
     *
     * @resolves {Array} The items on the remote content hub.
     */
    getRemoteItems (opts) {
        const helper = this;

        // Return the REST object's promise to get the remote items.
        return this._restApi.getItems(opts)
            .then(function (items) {
                // Keep track of each item's remote status.
                items.forEach(function (item) {
                    return helper._addRemoteStatus(item);
                });
                return items;
            });
    }

    /**
     * Create the given item on the remote content hub.
     *
     * @param {Object} item - The item to be created.
     * @param {Object} opts - The options to be used for the create operation.
     *
     * @returns {Q.Promise} A promise to create the given item on the remote content hub.
     *
     * @resolves {Object} The item that was created.
     */
    createRemoteItem (item, opts) {
        const helper = this;

        // Return the REST object's promise to create the remote item.
        return this._restApi.createItem(item, opts)
            .then(function (item) {
                // Keep track of the item's remote status.
                return helper._addRemoteStatus(item);
            });
    }

    /**
     * Push the local item with the given name to the remote content hub.
     *
     * Note: The remote item will be created if it does not exist, otherwise the remote item will be updated.
     *
     * @param {String} name - The name of the item to be pushed.
     * @param {Object} opts - The options to be used for the push operation.
     *
     * @returns {Q.Promise} A promise to push the local item with the given name to the remote content hub.
     *
     * @resolves {Object} The item that was pushed.
     */
    pushItem (name, opts) {
        const helper = this;

        // Clone the options so that our changes do not affect the original options.
        opts = utils.cloneOpts(opts);
        opts.originalPushFileName = name;

        // Return the promise to to get the local item and upload it to the content hub.
        return this._fsApi.getItem(name, opts)
            .then(function (item) {
                return helper._uploadItem(item, opts);
            });
    }

    /**
     * Push all items from the local file system to the remote content hub.
     *
     * Note: The remote items will be created if they do not exist, otherwise the remote items will be updated.
     *
     * @returns {Q.Promise} A promise to push the local items to the remote content hub.
     *
     * @resolves {Array} The items that were pushed.
     */
    pushAllItems (opts) {
        const helper = this;

        // Return the promise to to get the list of local item names and push those items to the content hub.
        return this._fsApi.listNames(opts)
            .then(function (names) {
                return helper._pushNameList(names, opts);
            });
    }

    /**
     * Push any modified items from the local file system to the remote content hub.
     *
     * Note: The remote items will be created if they do not exist, otherwise the remote items will be updated.
     *
     * @returns {Q.Promise} A promise to push the modified local items to the remote content hub.
     *
     * @resolves {Array} The modified items that were pushed.
     */
    pushModifiedItems (opts) {
        const helper = this;

        // Return the promise to to get the list of modified local item names and push those items to the content hub.
        return this.listModifiedLocalItemNames([helper.NEW, helper.MODIFIED], opts)
            .then(function (names) {
                return helper._pushNameList(names, opts);
            });
    }

    /**
     * Pull the item with the given id from the remote content hub to the local file system.
     *
     * Note: The local item will be created if it does not exist, otherwise the local item will be overwritten.
     *
     * @param {String} id - The ID of the item to be pulled.
     * @param {Object} opts - The options to be used for the pull operation.
     *
     * @returns {Q.Promise} A promise to pull the remote item to the local file system.
     *
     * @resolves {Array} The item that was pulled.
     */
    pullItem (id, opts) {
        const helper = this;

        // Return the promise to get the remote item and save it on the local file system.
        return this._restApi.getItem(id, opts)
            .then(function (item) {
                return helper._fsApi.saveItem(item, opts);
            })
            .then(function (item) {
                // Use the event emitter to indicate that the item was successfully pulled.
                helper._eventEmitter.emit("pulled", helper.getName(item));

                // Keep track of the item's local status.
                helper._addLocalStatus( item);
                return item;
            })
            .catch(function (err) {
                // Use the event emitter to indicate that there was an error pulling the item.
                helper._eventEmitter.emit("pulled-error", err, id);
                throw err;
            });
    }

    /**
     * Pull all items from the remote content hub to the local file system.
     *
     * @param {Object} opts - The options to be used for the pull operations.
     *
     * @returns {Q.Promise} A promise to pull the remote items to the local file system.
     *
     * @resolves {Array} The items that were pulled.
     */
    pullAllItems (opts) {
        // Create a deferred object to control the timing of this operation.
        const deferred = Q.defer();

        // Keep track of how many items were not pulled successfully.
        let errorCount = 0;
        const assetPulledError = function () {
            errorCount++;
        };
        this.getEventEmitter().on("pulled-error", assetPulledError);

        const helper = this;

        // Pull a "chunk" of remote items and and then recursively pull any remaining chunks.
        helper._pullItemsChunk(helper.getRemoteItems, opts)
            .then(function (items) {
                // The deferred will get resolved when all chunks have been pulled.
                helper._recursePull(helper.getRemoteItems, deferred, [], items, opts);
            })
            .catch(function (err) {
                deferred.reject(err);
            });

        // After the promise has been resolved, update the last pull timestamp (but only if there were no errors.)
        deferred.promise
            .then(function () {
                if (errorCount === 0) {
                    hashes.setLastPullTimestamp(this._fsApi.getDir(opts), new Date(), opts);
                }
            });

        // Return the promise we created.
        return deferred.promise;
    }

    /**
     * Pull any modified items from the remote content hub to the local file system.
     *
     * @param {Object} opts - The options to be used for the pull operations.
     *
     * @returns {Q.Promise} A promise to pull the modified remote items to the local file system.
     *
     * @resolves {Array} The modified items that were pulled.
     */
    pullModifiedItems (opts) {
        // Create a deferred object to control the timing of this operation.
        const deferred = Q.defer();

        // Keep track of how many items were not pulled successfully.
        let errorCount = 0;
        const assetPulledError = function () {
            errorCount++;
        };
        this.getEventEmitter().on("pulled-error", assetPulledError);

        const helper = this;

        // Pull a "chunk" of modified remote items and and then recursively pull any remaining chunks.
        const listFn = helper.getModifiedRemoteItems.bind(helper, [helper.NEW, helper.MODIFIED]);
        helper._pullItemsChunk(listFn, opts)
            .then(function (items) {
                // The deferred will get resolved when all chunks have been pulled.
                helper._recursePull(listFn, deferred, [], items, opts);
            })
            .catch(function (err) {
                deferred.reject(err);
            });

        // After the promise has been resolved, update the last pull timestamp (but only if there were no errors.)
        deferred.promise
            .then(function () {
                if (errorCount === 0) {
                    hashes.setLastPullTimestamp(this._fsApi.getDir(opts), new Date(), opts);
                }
            });

        // Return the promise we created.
        return deferred.promise;
    }

    /**
     * @returns {Promise} - A promise that resolves with an array of the names of
     *                      all items that exist on the file system.
     */
    listLocalItemNames (opts) {
        return this._fsApi.listNames(opts);
    }

    /**
     * @returns {Q.Promise} - A promise that resolves with an array of the names of
     *                      all items that exist on the file system which have
     *                      been modified since being pushed/pulled.
     */
    listModifiedLocalItemNames (flags, opts) {
        const helper = this;
        const fsObject = this._fsApi;
        const dir = fsObject.getPath(opts);
        return fsObject.listNames(opts)
            .then(function (itemNames) {
                const results = itemNames.filter(function (itemName) {
                    const itemPath = fsObject.getItemPath(itemName, opts);
                    return hashes.isLocalModified(flags, dir, itemPath, opts);
                });
                if (flags.indexOf(helper.DELETED) !== -1) {
                    return helper.listLocalDeletedNames(opts)
                        .then(function (itemNames) {
                            itemNames.forEach(function (itemName) {
                                results.push(itemName);
                            });
                            return results;
                        });
                } else {
                    return results;
                }
            });
    }

    listLocalDeletedNames (opts) {
        const fsObject = this._fsApi;
        const deferred = Q.defer();
        const dir = fsObject.getPath(opts);
        const extension = fsObject.getExtension();
        deferred.resolve(hashes.listFiles(dir, opts)
            .filter(function (path) {
                let stat = undefined;
                try {
                    stat = fs.statSync(dir + path);
                } catch (ignore) {
                    // ignore this error we're testing to see if a file exists
                }
                return !stat;
            })
            .filter(function (file) {
                return file.endsWith(extension);
            })
            .map(function (file) {
                return file.replace(extension, "");
            }));
        return deferred.promise;
    }

    /**
     * Get a list of the names of all remote items.
     *
     * @param {Object} opts - The options to be used for this operation.
     *
     * @returns {Q.Promise} - A promise for an array of the names of all remote items.
     */
    listRemoteItemNames (opts) {
        // Create the deferred to be used for recursively retrieving items.
        const deferred = Q.defer();

        // Recursively call restApi.getItems() to retrieve all of the remote items.
        const listFn = this._restApi.getItems.bind(this._restApi);

        // Get the first chunk of remote items, and then recursively retrieve any additional chunks.
        const self = this;
        self._listItemChunk(listFn, opts)
            .then(function (listInfo) {
                // Pass a value of null for results to indicate that we retrieved the first chunk. The deferred will be
                // resolved when all chunks have been retrieved. However, the retrieval process will never reject the
                // deferred, so we have to handle that explicitly.
                self._recurseList(listFn, deferred, null, listInfo, opts);
            })
            .catch(function (err) {
                // If the list function's promise is rejected, propogate that to the deferred that was returned.
                deferred.reject(err);
            });

        // Return the deferred promise chain.
        return deferred.promise
            .then(function (items) {
                // Turn the resulting list of items (metadata) into a list of item names.
                return items.map(function (item) {
                    if (opts && opts.includeNameInList === "true") {
                        return self.getName(item) + ' -- ' + item.name;
                    } else {
                        return self.getName(item);
                    }
                });
            });
    }

    /**
     * Get a list of the items that have been modified.
     *
     * @param {Array} flags - An array of the state (NEW, DELETED, MODIFIED) of the items to be included in the list.
     * @param {Object} opts - The options to be used for this operation.
     *
     * @returns {Q.Promise} - A promise for an array of all remote items that were modified since being pushed/pulled.
     */
    getModifiedRemoteItems (flags, opts) {
        const helper = this;
        const dir = helper._fsApi.getPath(opts);
        return helper._restApi.getModifiedItems(hashes.getLastPullTimestamp(dir, opts), opts)
            .then(function (items) {
                const results = items.filter(function (item) {
                    try {
                        const itemPath = helper._fsApi.getItemPath(item, opts);
                        return hashes.isRemoteModified(flags, item, dir, itemPath, opts);
                    } catch (err) {
                        utils.logErrors(i18n.__("error_filtering_remote_items"), err);
                    }
                });
                return results;
            });
    }

    /**
     * Get a list of the names of all remote items that have been modified.
     *
     * @param {Array} flags - An array of the state (NEW, DELETED, MODIFIED) of the items to be included in the list.
     * @param {Object} opts - The options to be used for this operation.
     *
     * @returns {Q.Promise} - A promise for an array of the names of all remote items that were modified since being
     *                        pushed/pulled.
     */
    listModifiedRemoteItemNames (flags, opts) {
        const deferred = Q.defer();
        const results = null;
        const self = this;
        const listFn = self.getModifiedRemoteItems.bind(self, flags);
        self._listItemChunk(listFn, opts)
            .then(function (listInfo) {
                self._recurseList(listFn, deferred, results, listInfo, opts);
            })
            .catch(function (err) {
                deferred.reject(err);
            });

        return deferred.promise
            .then(function (items) {
                const results = items.map(function (item) {
                    if (opts && opts.includeNameInList === "true") {
                        return self.getName(item) + ' -- ' + item.name;
                    } else {
                        return self.getName(item);
                    }
                });
                if (flags.indexOf(self.DELETED) !== -1) {
                    return self.listRemoteDeletedNames(opts)
                        .then(function (itemNames) {
                            itemNames.forEach(function (itemName) {
                                results.push(itemName);
                            });
                            return results;
                        });
                } else {
                    return results;
                }
            });
    }

    /**
     * Get a list of the names of all remote items that have been deleted.
     *
     * @param {Object} opts - The options to be used for this operation.
     *
     * @returns {Q.Promise} - A promise for an array of the names of all remote items that were deleted since being
     *                        pushed/pulled.
     */
    listRemoteDeletedNames (opts) {
        const deferred = Q.defer();
        const dir = this._fsApi.getDir(opts);
        const extension = this._fsApi.getExtension();

        this.listRemoteItemNames(opts)
            .then(function (remoteItemNames) {
                deferred.resolve(
                    hashes.listFiles(dir, opts)
                        .filter(function (file) {
                            return file.endsWith(extension);
                        })
                        .map(function (file) {
                            return file.replace(extension, "");
                        })
                        .filter(function (path) {
                            return (remoteItemNames.indexOf(path) === -1);
                        })
                );
            })
            .catch(function (err) {
                deferred.reject(err);
            });

        return deferred.promise;
    }

    /**
     * Delete the specified remote item.
     *
     * @param {String} id - The ID of the item to be deleted.
     * @param {Object} opts - The options to be used for the delete operation.
     *
     * @returns {Q.Promise} A promise for the deleted item.
     */
    deleteRemoteItem (id, opts) {
        const helper = this;
        const item = {id: id};

        // This function exists mostly for testing purposes
        return this._restApi.deleteItem(item, opts)
            .then(function () {
                helper._statusTracker.removeStatus(StatusTracker.EXISTS_REMOTELY);
                return item;
            });
    }

    /**
     *  Will return true if the item exists locally (may exist remotely too).
     *  Only works if the item was pulled using getLocalAndRemotes()
     *
     *  @returns {boolean}
     */
    existsLocally (item) {
        return this._statusTracker.existsLocally(item);
    }

    /**
     *  Will return true if the item exists remotely (may exist locally too).
     *  Only works if the item was pulled using getLocalAndRemotes()
     *
     *  @returns {boolean}
     */
    existsRemotely (item) {
        return this._statusTracker.existsRemotely(item);
    }

    reset () {
        this._statusTracker = new StatusTracker();
        this._eventEmitter = new events.EventEmitter();
    }

    _addRemoteStatus (item) {
        logger.trace('enter addRemoteStatus(item) ' + this.getName(item));
        this._statusTracker.addStatus(item, StatusTracker.EXISTS_REMOTELY);
        return item;
    }

    _addLocalStatus (item) {
        this._statusTracker.addStatus(item, StatusTracker.EXISTS_LOCALLY);
        return item;
    }

    _updatePushTimestamp (args) {
        return args;
    }

    _updatePullTimestamp (args) {
        return args;
    }

    _uploadItem (item, opts) {
        let promise;
        let logError;
        const isUpdate = item.id && item.rev;
        if (isUpdate) {
            promise = this._restApi.updateItem(item, opts);
            logError = i18n.__("push_error_updating_item");
        } else {
            // No ID, so it has to be created
            promise = this._restApi.createItem(item, opts);
            logError = i18n.__("push_error_creating_item");
        }

        const helper = this;
        return promise
            .then(function (item) {
                return helper._addRemoteStatus(item);
            })
            .then(function (item) {
                helper._eventEmitter.emit("pushed", helper.getName(item));
                const cOpts  = utils.cloneOpts(opts);
                cOpts.renameIfNeeded = true;
                return helper._fsApi.saveItem(item, opts);
            })
            .catch(function (err) {
                helper._eventEmitter.emit("pushed-error", err, helper.getName(item));
                utils.logErrors(logError + helper.getName(item), err);
                if (isUpdate && err.statusCode === 409) {
                    return helper._restApi.getItem(item.id, opts)
                        .then(function (item) {
                            const cOpts = utils.cloneOpts(opts);
                            cOpts.conflict = true;
                            return helper._fsApi.saveItem(item, cOpts)
                                .then(function () {
                                    // throw the original err for conflict
                                    throw(err);
                                })
                                .catch(function (error) {
                                    logger.warn(error);
                                    // throw the original err for conflict
                                    throw err;
                                });
                        })
                        .catch(function (error) {
                            logger.warn(error);
                            // throw the original err for conflict
                            throw err;
                        });
                } else {
                    throw(err);
                }
            });
    }

    /**
     * Push the items with the given names.
     *
     * @param {Array} names - The names of the items to be pushed.
     * @param {Object} opts - The options to be used for the push operations.
     *
     * @returns {Promise} A promise for the items that were pushed.
     *
     * @protected
     */
    _pushNameList (names, opts) {
        const helper = this;
        const concurrentLimit = options.getRelevantOption(opts, "concurrent-limit", helper._artifactName, "concurrent-limit");
        const results = utils.throttledAll(names.map(function (name) {
            return function () {
                return helper.pushItem(name, opts);
            };
        }), concurrentLimit);

        return results
            .then(function (promises) {
                promises = promises.filter(function (promise) {
                    if (promise.state === 'fulfilled') {
                        return promise;
                    }
                });
                return promises.map(function (promise) {
                    return promise.value;
                });
            })
            .then(function (items) {
                return items.map(function (item) {
                    return helper._addRemoteStatus(item);
                });
            })
            .then(function (items) {
                return helper._updatePushTimestamp(items);
            });
    }

    _getLatestTimestamp () {
        return new Date(0).getTime();
    }

    _pullItemsChunk (listFn, opts) {
        const helper = this;
        let items = [];
        const deferred = Q.defer();
        listFn.call(helper, opts)
            .then(function (itemList) {
                const promises = itemList.map(function (item) {
                    const name = helper.getName(item);
                    return helper._fsApi.saveItem(item, opts)
                        .then(function () {
                            helper._eventEmitter.emit("pulled", name);
                            helper._addLocalStatus(item);
                            return item;
                        });
                });
                return Q.allSettled(promises)
                    .then(function (promises) {
                        items = [];
                        promises.forEach(function (promise, index) {
                            if (promise.state === "fulfilled") {
                                items.push(promise.value);
                            }
                            else {
                                items.push(promise.reason);
                                helper._eventEmitter.emit("pulled-error", promise.reason, itemList[index].id);
                            }
                        });
                        deferred.resolve(items);
                    });
            })
            .then(function (items) {
                return helper._updatePullTimestamp(items);
            })
            .catch(function (err) {
                deferred.reject(err);
            });
        return deferred.promise;
    }

    _recursePull (listFn, deferred, allItems, items, opts) {
        const helper = this;
        //append the results from the previous chunk to the allItems array
        allItems.push.apply(allItems, items);
        const iLen = items.length;
        const limit = options.getRelevantOption(opts, "limit", helper._artifactName, "limit");
        //test to see if we got less than the full chunk size
        if (iLen === 0 || iLen < limit) {
            //resolve the deferred with the allItems array
            deferred.resolve(allItems);
        } else {
            //get the next chunk
            const offset = options.getRelevantOption(opts, "offset", helper._artifactName, "offset");
            // clone the opts to not affect the opts passed in
            const cOpts = utils.cloneOpts(opts);
            cOpts.offset = offset + limit;
            this._pullItemsChunk(listFn, cOpts)
                .then(function (items) {
                    helper._recursePull(listFn, deferred, allItems, items, cOpts);
                })
                .catch(function (err) {
                    deferred.reject(err);
                });
        }
    }

    _listItemChunk (listFn, opts) {
        // Get the next "chunk".
        return listFn(opts)
            .then(function (itemList) {
                return {length: itemList.length, items: itemList};
            });
    };

    _recurseList (listFn, deferred, results, listInfo, opts) {
        // If a results array is specified, accumulate the items listed.
        if (results) {
            results = results.concat(listInfo.items);
        } else {
            results = listInfo.items;
        }

        const iLen = listInfo.length;
        const limit = options.getRelevantOption(opts, "limit", this._artifactName, "limit");
        if (iLen === 0 || iLen < limit) {
            deferred.resolve(results);
        } else {
            const offset = options.getRelevantOption(opts, "offset", this._artifactName, "offset");
            // clone the opts to not change the passed in opts
            opts = utils.clone(opts);
            opts.offset = offset +  limit;
            const self = this;
            self._listItemChunk(listFn, opts)
                .then(function (listInfo) {
                    self._recurseList(listFn, deferred, results, listInfo, opts);
                });
        }
    };
}

/**
 * Export the BaseHelper class.
 */
module.exports = BaseHelper;
