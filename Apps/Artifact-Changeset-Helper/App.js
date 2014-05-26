Ext.define('ArtifactChangesetMover', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    items: [
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

    _selectedArtifactType: null,
    _selectedArtifact: null,
    _artifactChangesetsByChangesetOid: {},
    _changesetArtifactsByChangesetOid: {},
    _selectedIteration: null,
    _moveChangesetTargetArtifact: null,

    _iterationCombobox: null,
    _artifactTypeCombobox: null,
    _artifactCombobox: null,

    _artifactGrid: null,
    _changesetGrid: null,
    _targetArtifactChooserDialog: null,
    _moveChangesetAttributesDialog: null,
    _moveChangesetTargetArtifactCombobox: null,

    launch: function() {

        // Get the hostname
        this._getHostName();

        // Grab and use the timebox scope if we have it
        var timeboxScope = this.getContext().getTimeboxScope();

        if(timeboxScope) {
            var record = timeboxScope.getRecord();
            var name = record.get('Name');

            this._selectedIteration = record.data;
            this._onIterationSelect();

        // Otherwise add an iteration combo box to the page
        } else {
            // add the iteration dropdown selector

            this._iterationCombobox = Ext.create('Rally.ui.combobox.IterationComboBox', {
                itemId : 'iterationSelector',
                fieldLabel: 'Choose Iteration',
                listeners: {
                    select: this._onIterationSelect,
                    ready:  this._onIterationSelect,
                    scope:  this
                },
                minWidth: 500
            });

            this.down("#controlsContainer").add( this._iterationCombobox );
        }

        var artifactTypesStore = Ext.create('Ext.data.Store', {
            fields: ['name', 'type'],
            data: [
                {"name": "User Story",     "type": "HierarchicalRequirement"},
                {"name": "Defect",         "type": "Defect"},
                {"name": "Task",           "type": "Task"}
            ]
        });

        this._artifactTypeCombobox = Ext.create('Ext.form.ComboBox', {
            fieldLabel:   'Choose Artifact Type',
            store:        artifactTypesStore,
            queryMode:    'local',
            displayField: 'name',
            valueField:   'type',
            minWidth: 500,
            listeners: {
                scope: this,
                'select': this._populateArtifactCombobox
            }
        });

        this.down("#controlsContainer").add(this._artifactTypeCombobox);

    },

    _getHostName: function() {
        testUrl = window.location.hostname || "rally1.rallydev.com";
        testUrlSplit = testUrl.split("/");
        if (testUrlSplit.length === 1) {
            this._rallyHost = "rally1.rallydev.com";
        } else {
            this._rallyHost = testUrlSplit[2];
        }
        this._rallyServer = "https://" + this._rallyHost;
    },

    onTimeboxScopeChange: function(newTimeboxScope) {
        this.callParent(arguments);

        if(newTimeboxScope) {
            var record = newTimeboxScope.getRecord();

            this._selectedIteration = record.data;
        }
    },

    _onIterationSelect : function() {

        if (_.isUndefined( this.getContext().getTimeboxScope())) {
            var value =  this._iterationCombobox.getRecord();
            this._selectedIteration = value.data;
        }
    },

    _populateArtifactCombobox: function() {

        var me = this;

        if (this._artifactCombobox) {
            this._artifactCombobox.destroy();
        }

        this._artifactCombobox = Ext.create('Ext.Container', {
            items: [{
                xtype: 'rallycombobox',
                fieldLabel:   'Choose Artifact',
                storeConfig: {
                    autoLoad: true,
                    model: me._artifactTypeCombobox.getValue(),
                    filters: [
                        {
                            property: 'Iteration.Name',
                            operator: '=',
                            value: me._selectedIteration.Name
                        }
                    ]
                },
                listeners: {
                    scope: this,
                    'select': me._hydrateData
                }
            }]
        });

        this.down('#controlsContainer').add(this._artifactCombobox);

    },

    _hydrateData: function(combobox, records) {

        console.log('_hydrateData');

        var me = this;
        me._selectedArtifact = records[0];

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

        console.log('_getArtifactChangesetCollection');

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

        console.log('_hydrateArtifactChangesets');

        var deferred = Ext.create('Deft.Deferred');
        var me = scope;

        var changeSets           = [];

        var artifactRef          = artifact.get('_ref');
        var artifactObjectID     = artifact.get('ObjectID');
        var artifactFormattedID  = artifact.get('FormattedID');
        var artifactName         = artifact.get('Name');

        var changesetCollection  = artifact.getCollection("Changesets",
            { fetch: ['Author','Artifacts','Revision','Message','CommitTimestamp'] }
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
        console.log('_getHashLength');

        var size = 0, key;
        for (key in hash) {
            if (hash.hasOwnProperty(key)) size++;
        }
        return size;
    },

    _getChangesetArtifactsCollection: function(scope, type) {

        console.log('_getChangesetArtifactsCollection');

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
        //changeset = changeset[0];

        console.log('_hydrateChangesetArtifacts');

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

        console.log('_makeGrids');
        var me = scope;
        me._makeArtifactGrid(me);

    },

    _makeArtifactGrid: function(scope) {

        console.log('_makeArtifactGrid');

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
                }
            ]
        });

        me.down('#gridContainer').add(me._artifactGrid);
        me._artifactGrid.reconfigure(gridStore);
        me._makeChangesetGrid(me);
    },

    _makeChangesetGrid: function(scope) {

        console.log('_makeChangesetGrid');

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
                            artifactsHtml.push(
                                '<a href="' + me._rallyServer + '/#/detail/' + artifactType + '/' +
                                artifactObjectID + '">' + artifactLabel + '</a>'
                            );
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

    },

    _selectTargetArtifactForChangesetMove: function(changesetrecord, scope) {

        console.log('_selectTargetArtifactForChangesetMove');
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

        console.log('_createMoveChangesetAttributesDialog');

        var me = scope;

        var message = "Define Updated Changeset Attributes";
        var confirmLabel = "Move Changeset";
        var currentCommitMessage = sourcechangeset.Message || '' ;

        me._moveChangesetAttributesDialog = Ext.create('ArtifactChangesetMover.ChangesetNewAttribsDialog', {
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

        console.log('_moveChangeset');

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

        console.log('_confirmDeleteChangeset');

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

        console.log('_deleteChangeset');

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