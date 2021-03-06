Ext.define('ArtifactChangesetHelper', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    items: [
        {
            xtype: 'container',
            itemId: 'labelContainer',
            html: 'Select a Story, Defect, or Task:',
            padding: '10px'
        },
        {
            xtype: 'container',
            itemId: 'controlsContainer',
            columnWidth: 1
        },
        {
            xtype: 'container',
            itemId: 'gridContainer',
            columnWidth: 1
        }
    ],

    _rallyServer: null,

    _scmRepositories: null,

    _selectedArtifact: null,
    _artifactChangesetsByChangesetOid: {},
    _changesetArtifactsByChangesetOid: {},

    _moveChangesetTargetArtifact: null,

    _openSelectDialogButton: null,

    _artifactGrid: null,
    _changesetGrid: null,
    _missingRequireDataDialog: null,
    _targetArtifactChooserDialog: null,
    _moveChangesetAttributesDialog: null,
    _moveChangesetTargetArtifactCombobox: null,

    launch: function() {

        var me = this;

        // Populate some initial data

        // Get the hostname
        this._getHostName();

        // Get SCM Repositories
        this._getSCMRepositories();

        // Get CurrentUser
        this._currentUser = this.getContext().getUser();
    },

    _getSCMRepositories: function() {

        // console.log('_getSCMRepositories');

        var me = this;

        Ext.create('Rally.data.wsapi.Store', {
            model: 'SCMRepository',
            fetch: ['ObjectID', 'Name', 'Uri'],
            autoLoad: true,
            limit: 4000,
            context: {
                projectScopeUp: false,
                projectScopeDown: false
            },
            listeners: {
                scope: this,
                // kick us off
                load: function(store, data) {
                    me._scmRepositories = data;
                    this._buildUI();
                }
            }
        });
    },

    _buildUI: function() {

        // console.log('_buildUI');
        var me = this;

        // Start us off
        this._openSelectDialogButton = Ext.create('Rally.ui.Button', {
            text: 'Select an Artifact',
            handler: function() {
                me._createSelectInitialArtifactDialog();
            }
        });

        this.down('#controlsContainer').add(this._openSelectDialogButton);

    },

    _getHostName: function() {

        // console.log('_getHostName');

        testUrl = window.location.hostname || "rally1.rallydev.com";
        testUrlSplit = testUrl.split("/");
        if (testUrlSplit.length === 1) {
            this._rallyHost = "rally1.rallydev.com";
        } else {
            this._rallyHost = testUrlSplit[2];
        }
        this._rallyServer = "https://" + this._rallyHost;
    },

    _createSelectInitialArtifactDialog: function() {

        // console.log('_createSelectInitialArtifactDialog');

        var me = this;

        me._selectInitialArtifactDialog = Ext.create('Rally.ui.dialog.ChooserDialog', {
            artifactTypes: ['UserStory', 'Defect', 'Task'],
            autoShow: true,
            height: 600,
            title: 'Choose Artifact',
            listeners: {
                artifactChosen: function(artifact) {
                    me._hydrateData(artifact);
                },
                scope: me
            }
         });

    },

    _hydrateData: function(record) {

        // console.log('_hydrateData');

        var me = this;
        me.setLoading("Loading Changeset Data...");
        me._selectedArtifact = record;

        // Clear out any previous data
        me._artifactChangesetsByChangesetOid = {};
        me._changesetArtifactsByChangesetOid = {};

        // Promise functions
        var getArtifactChangesetCollectionPromise = function() {
            return me._getArtifactChangesetCollection(me);
        };

        // Hydrate the "back-end" of the many-to-many relationship
        // Between Changesets and artifacts
        // Note: this is a workaround - going by each individual artifact type
        // To account for the fact that changeset.getCollection('Artifacts')
        // fails - there's no model type for Artifact

        var getChangesetStoriesCollectionPromise = function() {
            return me._getChangesetArtifactsCollection(me, 'UserStory');
        };

        var getChangesetDefectsCollectionPromise = function() {
            return me._getChangesetArtifactsCollection(me, 'Defect');
        };

        var getChangesetTasksCollectionPromise = function() {
            return me._getChangesetArtifactsCollection(me, 'Task');
        };

        var promises = [
            getArtifactChangesetCollectionPromise,
            getChangesetStoriesCollectionPromise,
            getChangesetDefectsCollectionPromise,
            getChangesetTasksCollectionPromise
        ];

        // Chain the promises and go
        Deft.Chain.sequence(promises).then({
            scope: this,
            success: function(records) {
                me._makeGrids(me);
            },
            failure: function(error) {
                deferred.reject("Problem resolving chain " + error);
            }
        });
    },

    _getArtifactChangesetCollection: function(scope) {

        // console.log('_getArtifactChangesetCollection');

        var me = scope;
        var artifact = me._selectedArtifact;

        var promises = [];
        var deferred = Ext.create('Deft.Deferred');

        promises.push(me._hydrateArtifactChangesets(artifact, me));

        Deft.Promise.all(promises).then({
            success: function(results) {
                // De-reference, because Deft wraps deferred.resolve return value
                // inside an array
                var theseChangesets = results[0];
                Ext.Array.each(theseChangesets, function(changeset) {
                    var changesetOID = changeset.get('ObjectID');
                    me._artifactChangesetsByChangesetOid[changesetOID] = changeset;
                });
                deferred.resolve([]);
            }
        });

        return deferred;
    },

    _hydrateArtifactChangesets: function(artifact, scope) {

        // console.log('_hydrateArtifactChangesets');

        var deferred = Ext.create('Deft.Deferred');
        var me = scope;

        var changeSets           = [];

        var artifactRef          = artifact.get('_ref');
        var artifactObjectID     = artifact.get('ObjectID');
        var artifactFormattedID  = artifact.get('FormattedID');
        var artifactName         = artifact.get('Name');

        var changesetCollection  = artifact.getCollection("Changesets",
            { fetch: ['Author','Artifacts','Name','Revision','Message','CommitTimestamp'] }
        );

        var changesetCount       = changesetCollection.getCount();

        changesetCollection.load({
            callback: function(records, operation, success) {
                deferred.resolve(records);
            }
        });
        return deferred;
    },

    _getHashLength: function(hash) {
        // console.log('_getHashLength');

        var size = 0, key;
        for (key in hash) {
            if (hash.hasOwnProperty(key)) size++;
        }
        return size;
    },

    _getChangesetArtifactsCollection: function(scope, type) {

        // console.log('_getChangesetArtifactsCollection');

        var me = scope;
        var changesetsByChangesetOID = me._artifactChangesetsByChangesetOid;

        var promises = [];
        var deferred = Ext.create('Deft.Deferred');

        if (me._getHashLength(changesetsByChangesetOID) > 0) {

            Ext.iterate(changesetsByChangesetOID, function(OID, changeset) {
                promises.push(me._hydrateChangesetArtifacts(changeset, type, me));
            });

            Deft.Promise.all(promises).then({
                success: function(results) {
                    deferred.resolve([]);
                }
            });
        } else {
            deferred.resolve([]);
        }
        return deferred;
    },

    _hydrateChangesetArtifacts: function(changeset, artifactType, scope) {

        var me = scope;

        // console.log('_hydrateChangesetArtifacts');

        var deferred = Ext.create('Deft.Deferred');

        var changesetRef         = changeset.get('_ref');
        var changesetObjectID    = changeset.get('ObjectID');
        var changesetArtifacts   = [];

        if (me._changesetArtifactsByChangesetOid[changesetObjectID]) {
            changesetArtifacts = me._changesetArtifactsByChangesetOid[changesetObjectID];
        }

        Ext.create('Rally.data.wsapi.Store', {
            model: artifactType,
            autoLoad: true,
            fetch: ['Name', 'FormattedID', 'ObjectID'],
            filters: [
                {
                    property: 'Changesets.ObjectID',
                    operator: '=',
                    value: changesetObjectID
                }
            ],
            listeners: {
                load: function(store, records, success) {
                    Ext.Array.each(records, function(artifact) {
                        changesetArtifacts.push(artifact);
                    });

                    me._changesetArtifactsByChangesetOid[changesetObjectID] = changesetArtifacts;
                    deferred.resolve([]);
                }
            }
        });
        return deferred;
    },

    _makeGrids: function(scope) {

        // console.log('_makeGrids');
        var me = scope;
        me._makeArtifactGrid(me);

    },

    _makeArtifactGrid: function(scope) {

        // console.log('_makeArtifactGrid');

        var me = scope;

        if (me._artifactGrid) {
            me._artifactGrid.destroy();
        }


        var gridStore = Ext.create('Rally.data.custom.Store', {
            data: me._selectedArtifact,
            pageSize: 1,
            remoteSort: false
        });

        me._artifactGrid = Ext.create('Rally.ui.grid.Grid', {
            itemId: 'artifactGrid',
            store: gridStore,

            columnCfgs: [
                {
                    text: 'Formatted ID', dataIndex: 'FormattedID', xtype: 'templatecolumn',
                    tpl: Ext.create('Rally.ui.renderer.template.FormattedIDTemplate')
                },
                {
                    text: 'Name', dataIndex: 'Name', flex: 1
                },
                {
                    text: 'Create Changeset',
                    renderer: function (value, model, record) {
                        var id = Ext.id();
                        Ext.defer(function () {
                            Ext.widget('button', {
                                renderTo: id,
                                text: 'New Changeset',
                                width: 120,
                                handler: function () {
                                    me._createChangesetDialog(record, me);
                                }
                            });
                        }, 50);
                        return Ext.String.format('<div id="{0}"></div>', id);
                    },
                    flex: 1
                }
            ]
        });

        me.down('#gridContainer').add(me._artifactGrid);
        me._artifactGrid.reconfigure(gridStore);

        // Now that we have the Artifact grid constructed, create a grid for its changesets
        me._makeChangesetGrid(me);
    },

    _createChangesetDialog: function(artifact, scope) {

        // console.log('_createChangesetDialog');

        var me = scope;

        var message = "Define New Changeset Attributes";
        var confirmLabel = "Create Changeset";

        me._moveChangesetAttributesDialog = Ext.create('ArtifactChangesetHelper.ChangesetNewAttribsDialog', {
            message: message,
            targetFormattedID: artifact.get('FormattedID'),
            confirmLabel: confirmLabel,
            showRevisionField: true,
            scmRepositories: me._scmRepositories,
            listeners: {
                confirm: function(dialog, commitMessage, revisionNumber, scmRepository) {
                    me._createNewChangeset(artifact, commitMessage, revisionNumber, scmRepository, scope);
                }
            }
        });
    },

    _createNewChangeset: function(artifact, commitMessage, revisionNumber, scmRepository, scope) {

        // console.log('_createNewChangeset');

        var me = scope;

        if (!commitMessage || !revisionNumber || !scmRepository) {
            me._missingRequiredData(me);
        } else {

            var commitTimestamp = Rally.util.DateTime.toIsoString( new Date(), true );

            var changesetModel = Rally.data.ModelFactory.getModel({
                type: 'Changeset',
                scope: this,
                success: function(model, operation) {

                    var newChangesetRecord = Ext.create(model, {
                        Revision: revisionNumber,
                        SCMRepository: {"_ref": scmRepository.get('_ref')},
                        Artifacts: [
                            {"_ref": artifact.get('_ref')}
                        ],
                        Message: commitMessage,
                        CommitTimestamp: commitTimestamp,
                        Author: {"_ref": me._currentUser._ref}
                    });

                    newChangesetRecord.save({
                        callback: function(result, operation) {
                            if (operation.wasSuccessful()) {
                                // Notify of succcess

                                var successMessage = "Successfully Created New Changeset!";

                                Ext.create('Rally.ui.dialog.ConfirmDialog', {
                                    title: "Changeset Created!",
                                    message: successMessage,
                                    confirmLabel: "Ok",
                                    listeners: {
                                        confirm: function () {
                                            Ext.defer(function() {
                                                if (me._changesetGrid) {
                                                    // Re-build and Re-display grid LESS the moved changeset
                                                    me._hydrateData(artifact);
                                                }
                                            }, 500);
                                            return;
                                        }
                                    }
                                });
                            } else {
                                Ext.create('Rally.ui.dialog.ConfirmDialog', {
                                    title: "Changeset Not Created",
                                    message: "Error Creating Changeset!",
                                    confirmLabel: "Ok",
                                    listeners: {
                                        confirm: function () {
                                            return;
                                        }
                                    }
                                });
                            }
                        }
                    });
                }
            });
        }
    },

    _missingRequiredData: function(scope) {

        // console.log('_missingRequiredData');

        var me = this;

        if (me._missingRequireDataDialog) {
            me._missingRequireDataDialog.destroy();
        }

        me._missingRequireDataDialog = Ext.create('Rally.ui.dialog.ConfirmDialog', {
            title: "Missing Requied Changeset Data.",
            message: "Please include Revision, SCMRepo, and Message",
            confirmLabel: "Ok",
            listeners: {
                confirm: function(){
                    return;
                }
            }
        });
    },

    _makeChangesetGrid: function(scope) {

        // console.log('_makeChangesetGrid');

        var me = scope;

        if (me._changesetGrid) {
            me._changesetGrid.destroy();
        }

        var changesets = [];

        Ext.iterate(me._artifactChangesetsByChangesetOid, function(OID, changeset) {
            var changesetOID = OID;
            var changesetArtifacts = me._changesetArtifactsByChangesetOid[changesetOID] || [];
            var changesetWithArtifacts = {
                "_ref"             : changeset.get('_ref'),
                "ObjectID"         : changeset.get('ObjectID'),
                "Name"             : changeset.get('Name'),
                "Revision"         : changeset.get('Revision'),
                "CommitTimestamp"  : changeset.get('CommitTimestamp') || '',
                "Message"          : changeset.get('Message'),
                "Author"           : changeset.get('Author'),
                "Artifacts"        : changesetArtifacts
            };
            changesets.push(changesetWithArtifacts);
        });

        var gridStore = Ext.create('Rally.data.custom.Store', {
            data: changesets,
            pageSize: 1000,
            remoteSort: false
        });

        me._changesetGrid = Ext.create('Rally.ui.grid.Grid', {
            itemId: 'changesetGrid',
            store: gridStore,

            columnCfgs: [
                {
                    text: 'Name', dataIndex: 'Name', flex: 1
                },
                {
                    text: 'Revision', dataIndex: 'Revision'
                },
                {
                    text: 'Commit Time Stamp', dataIndex: 'CommitTimestamp'
                },
                {
                    text: 'Author', dataIndex: 'Author',
                    renderer: function(value) {
                        if (value) {
                            return value._refObjectName;
                        }
                    }
                },
                {
                    text: 'Artifacts', dataIndex: 'Artifacts',
                    renderer: function(values) {
                        var artifactsHtml = [];
                        Ext.Array.each(values, function(artifact) {
                            var artifactObjectID = artifact.get('ObjectID');
                            var artifactFormattedID = artifact.get('FormattedID');
                            var artifactName = artifact.get('Name');
                            var artifactType = artifact.get('_type');
                            if (artifactType === "hierarchicalrequirement") {
                                artifactType = "userstory";
                            }
                            var artifactLabel = artifactFormattedID + ": " + artifactName;

                            var linkTemplate = new Ext.Template('<a href="{rallyServer}/#/detail/{artifactType}/{artifactOID}" target="_blank">{artifactLabel}</a>');
                            var artifactHtml = linkTemplate.apply({
                                rallyServer: me._rallyServer,
                                artifactType: artifactType,
                                artifactOID: artifactObjectID,
                                artifactLabel: artifactLabel
                            });

                            artifactsHtml.push(artifactHtml);

                        });
                        return artifactsHtml.join('<br/> ');
                    },
                    flex: 1
                },
                {
                    text: 'Message', dataIndex: 'Message', flex: 1
                },
                {
                    text: 'Move',
                    renderer: function (value, model, record) {
                        var id = Ext.id();
                        Ext.defer(function () {
                            Ext.widget('button', {
                                renderTo: id,
                                text: 'Move Changeset',
                                width: 120,
                                handler: function () {
                                    me._selectTargetArtifactForChangesetMove(record.data, me);
                                }
                            });
                        }, 50);
                        return Ext.String.format('<div id="{0}"></div>', id);
                    },
                    flex: 1
                },
                {
                    text: 'Delete',
                    renderer: function (value, model, record) {
                        var id = Ext.id();
                        Ext.defer(function () {
                            Ext.widget('button', {
                                renderTo: id,
                                text: 'Delete Changeset',
                                width: 120,
                                handler: function () {
                                    me._confirmDeleteChangeset(record.data, me);
                                }
                            });
                        }, 50);
                        return Ext.String.format('<div id="{0}"></div>', id);
                    },
                    flex: 1
                }
            ]
        });

        me.down('#gridContainer').add(me._changesetGrid);
        me._changesetGrid.reconfigure(gridStore);
        me.setLoading(false);
    },

    _selectTargetArtifactForChangesetMove: function(changesetrecord, scope) {

        // console.log('_selectTargetArtifactForChangesetMove');
        var me = scope;

        me._targetArtifactChooserDialog = Ext.create('Rally.ui.dialog.ChooserDialog', {
            artifactTypes: ['UserStory', 'Defect', 'Task'],
            autoShow: true,
            height: 600,
            title: 'Choose Target Artifact to Receive Changeset',
            listeners: {
                artifactChosen: function(targetartifact) {
                    me._createMoveChangesetAttributesDialog(changesetrecord, targetartifact, scope);
                },
                scope: this
            }
         });
    },

    _createMoveChangesetAttributesDialog: function(sourcechangeset, targetartifact, scope) {

        // console.log('_createMoveChangesetAttributesDialog');

        var me = scope;

        var message = "Define Updated Changeset Attributes";
        var confirmLabel = "Move Changeset";
        var currentCommitMessage = sourcechangeset.Message || '' ;

        me._moveChangesetAttributesDialog = Ext.create('ArtifactChangesetHelper.ChangesetNewAttribsDialog', {
            message: message,
            targetFormattedID: targetartifact.get('FormattedID'),
            currentCommitMessage: currentCommitMessage,
            confirmLabel: confirmLabel,
            listeners: {
                confirm: function(dialog, newcommitmessage){
                    me._moveChangeset(sourcechangeset, targetartifact, newcommitmessage, scope);
                }
            }
        });
    },

    _moveChangeset: function(sourcechangeset, targetartifact, newcommitmessage, scope) {

        // console.log('_moveChangeset');

        var me = scope;
        var changesetOID = sourcechangeset.ObjectID;

        var changesetModel = Rally.data.ModelFactory.getModel({
            type: 'Changeset',
            scope: this,
            success: function(model, operation) {
                model.load(changesetOID, {
                    scope: this,
                    success: function(changesetHydrated, operation) {

                        // Ref of currently selected Artifact that we want to disassociate from the
                        // changeset
                        var sourceArtifact = me._selectedArtifact;
                        var sourceArtifactRef = sourceArtifact.get('_ref');

                        var existingArtifacts = me._changesetArtifactsByChangesetOid[changesetOID];
                        var existingArtifactRefs = [];
                        Ext.Array.each(existingArtifacts, function(artifact) {
                            existingArtifactRefs.push(artifact.get('_ref'));
                        });

                        // Remove existingArtifact ref from array of Artifact refs
                        var updatedArtifactRefs = existingArtifactRefs;
                        var index = updatedArtifactRefs.indexOf(sourceArtifactRef);

                        if (index > -1) {
                            updatedArtifactRefs.splice(index, 1);
                        }

                        // Now add the targetArtifact into our array of Artifact refs
                        updatedArtifactRefs.push(targetartifact.get('_ref'));

                        // Now map into appropriate structure for attributes
                        var updatedArtifactsArray = _.map(updatedArtifactRefs, function(ref) { return {_ref: ref}; });

                        changesetHydrated.set('Artifacts', updatedArtifactsArray);
                        changesetHydrated.set('Message', newcommitmessage);

                        changesetHydrated.save({
                            callback: function(result, operation) {
                                if(operation.wasSuccessful()) {

                                    // Remove Changeset from the hash that is used to construct the changeset grid
                                    Ext.defer(function() {
                                        delete(me._artifactChangesetsByChangesetOid[changesetOID]);
                                    }, 100);

                                    var successMessage = "Changeset Successfully Moved To: " + targetartifact.get('FormattedID');

                                    // Notify of succcess
                                    Ext.create('Rally.ui.dialog.ConfirmDialog', {
                                        title: "Changeset Moved",
                                        message: successMessage,
                                        confirmLabel: "Ok",
                                        listeners: {
                                            confirm: function () {
                                                Ext.defer(function() {
                                                    if (me._changesetGrid) {
                                                        // Re-build and Re-display grid LESS the moved changeset
                                                        me._changesetGrid.destroy();
                                                        me._makeChangesetGrid(me);
                                                    }
                                                }, 500);
                                                return;
                                            }
                                        }
                                    });
                                } else {
                                    Ext.create('Rally.ui.dialog.ConfirmDialog', {
                                        title: "Changeset Not Moved",
                                        message: "Error Moving Changeset!",
                                        confirmLabel: "Ok",
                                        listeners: {
                                            confirm: function () {
                                                return;
                                            }
                                        }
                                    });
                                }
                            }
                        });
                    }
                });
            }
        });
    },

    _confirmDeleteChangeset: function(record, scope) {

        // console.log('_confirmDeleteChangeset');

        var me = scope;

        var confirmLabel = "Delete Changeset Permanently";
        var message = "Really Delete Changeset? Deleted Changeset cannot be recovered.";

        Ext.create('Rally.ui.dialog.ConfirmDialog', {
            message: message,
            confirmLabel: confirmLabel,
            listeners: {
                confirm: function(){
                    me._deleteChangeset(record, scope);
                }
            }
        });
    },

    _deleteChangeset: function(record, scope) {

        // console.log('_deleteChangeset');

        var me = scope;
        var changesetOID = record.ObjectID;

        var changesetModel = Rally.data.ModelFactory.getModel({
            type: 'Changeset',
            scope: this,
            success: function(model, operation) {
                model.load(changesetOID, {
                    scope: this,
                    success: function(changesetHydrated, operation) {
                        changesetHydrated.destroy({
                            callback: function(result, operation) {
                                if(operation.wasSuccessful()) {

                                    // Remove Changeset from the hash that is used to construct the changeset grid
                                    Ext.defer(function() {
                                        delete(me._artifactChangesetsByChangesetOid[changesetOID]);
                                    }, 100);

                                    // Notify of successful deletion
                                    Ext.create('Rally.ui.dialog.ConfirmDialog', {
                                        title: "Changeset Deleted",
                                        message: "Changeset Successfully Removed!",
                                        confirmLabel: "Ok",
                                        listeners: {
                                            confirm: function () {
                                                Ext.defer(function() {
                                                    if (me._changesetGrid) {
                                                        // Re-build and Re-display changeset grid LESS the deleted changeset
                                                        me._changesetGrid.destroy();
                                                        me._makeChangesetGrid(me);
                                                    }
                                                }, 500);
                                                return;
                                            }
                                        }
                                    });
                                } else {
                                    Ext.create('Rally.ui.dialog.ConfirmDialog', {
                                        title: "Changeset Not Removed",
                                        message: "Error Removing Changeset!",
                                        confirmLabel: "Ok",
                                        listeners: {
                                            confirm: function () {
                                                return;
                                            }
                                        }
                                    });
                                }
                            }
                        });
                    }
                });
            }
        });
    }

});