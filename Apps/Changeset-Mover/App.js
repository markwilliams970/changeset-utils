Ext.define('ChangesetMover', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    items: [
        {
            xtype: 'container',
            itemId: 'labelContainer',
            html: 'Find Changesets With Commit Timestamps Between:',
            padding: '10px'
        },
        {
            xtype: 'container',
            itemId: 'startDateTimeChooser',
            flex: 1,
            layout: 'hbox',
            padding: '10px'
        },
        {
            xtype: 'container',
            itemId: 'endDateTimeChooser',
            flex: 1,
            layout: 'hbox',
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

    _startDateString: null,
    _endDateString: null,
    _startDateStringUTC: null,
    _endDateStringUTC: null,

    _startHourString: '00',
    _endHourString: '23',

    _startMinuteString: '00',
    _endMinuteString: '59',

    _startHourCombobox: null,
    _startMinuteCombobox: null,
    _startDateTextField: null,
    _startDateChooserDialog: null,

    _endHourCombobox: null,
    _endMinuteCombobox: null,
    _endDateTextField: null,
    _endDateChooserDialog: null,

    _startDateIsInFutureDialog: null,
    _startDateIsGTEndDateDialog: null,

    _findChangesetsButton: null,

    launch: function() {

        var me = this;

        // Rally server
        me._getHostName();

        // Initialize default values for start and end dates
        me._initializeDefaultDates();

        // Instantiate UI
        me._buildUI();

    },

    _buildUI: function() {

        console.log('_buildUI');

        var me = this;

        // Build date choosers
        var startDateText =  me._startDateString;

        this._startDateTextField = Ext.create('Rally.ui.TextField', {
            fieldLabel: 'Start Date',
            value: startDateText,
            listeners: {
                render: function() {
                    this.getEl().on('mousedown', function(e, t, eOpts) {
                        me._createStartDateChooserDialog();
                    });
                }
            }
        });

        // Build date choosers
        var endDateText = me._endDateString;

        this._endDateTextField = Ext.create('Rally.ui.TextField', {
            fieldLabel: 'End Date',
            value: endDateText,
            listeners: {
                render: function() {
                    this.getEl().on('mousedown', function(e, t, eOpts) {
                        me._createEndDateChooserDialog();
                    });
                }
            }
        });

        // Build Hour choosers
        var hourData = [];

        for (var i = 0; i <= 23; i++) {
            var hourKeyAndValue = me._padIntegerToString(i, 2);
            var record = {
                "name": hourKeyAndValue,
                "value": hourKeyAndValue
            };
            hourData.push(record);
        }

        var hourStore = Ext.create('Ext.data.Store', {
            fields: ['name', 'value'],
            data: hourData
        });

        this._startHourCombobox = Ext.create('Ext.form.ComboBox', {
            fieldLabel:   'Start Hour:',
            store:        hourStore,
            queryMode:    'local',
            displayField: 'name',
            valueField:   'value',
            value: hourStore.getAt(0).get('value'),
            listeners: {
                scope: this,
                'select': function(combobox, records) {
                    me._startHourString = records[0].get('value');
                }
            }
        });

        this._endHourCombobox = Ext.create('Ext.form.ComboBox', {
            fieldLabel:   'End Hour:',
            store:        hourStore,
            queryMode:    'local',
            displayField: 'name',
            valueField:   'value',
            value: hourStore.getAt(23).get('value'),
            listeners: {
                scope: this,
                'select': function(combobox, records) {
                    me._endHourString = records[0].get('value');
                }
            }
        });

        // Build Minute chooser
        var minuteData = [];

        for (i = 0; i <= 59; i ++) {
            var minuteKeyAndValue = me._padIntegerToString(i, 2);
            var minuteRecord = {
                "name": minuteKeyAndValue,
                "value": minuteKeyAndValue
            };
            minuteData.push(minuteRecord);
        }

        var minuteStore = Ext.create('Ext.data.Store', {
            fields: ['name', 'value'],
            data: minuteData
        });

        this._startMinuteCombobox = Ext.create('Ext.form.ComboBox', {
            fieldLabel:   "Start Minute:",
            store:        minuteStore,
            queryMode:    'local',
            displayField: 'name',
            valueField:   'value',
            value: minuteStore.getAt(0).get('value'),
            listeners: {
                scope: this,
                'select': function(combobox, records) {
                    me._startMinuteString = records[0].getValue();
                }
            }
        });

        this._endMinuteCombobox = Ext.create('Ext.form.ComboBox', {
            fieldLabel:   "End Minute:",
            store:        minuteStore,
            queryMode:    'local',
            displayField: 'name',
            valueField:   'value',
            value: minuteStore.getAt(59).get('value'),
            listeners: {
                scope: this,
                'select': function(combobox, records) {
                    me._endMinuteString = records[0].get('value');
                }
            }
        });

        this.down('#startDateTimeChooser').add(this._startDateTextField);
        this.down('#startDateTimeChooser').add(this._startHourCombobox);
        this.down('#startDateTimeChooser').add(this._startMinuteCombobox);

        this.down('#endDateTimeChooser').add(this._endDateTextField);
        this.down('#endDateTimeChooser').add(this._endHourCombobox);
        this.down('#endDateTimeChooser').add(this._endMinuteCombobox);

        this._findChangesetsButton = Ext.create('Ext.Container', {
            items: [{
                xtype: 'rallybutton',
                text: 'Look For Changesets',
                handler: function() {
                    me._validateTimebox();
                }
            }]
        });

        this.down('#controlsContainer').add(this._findChangesetsButton);

    },

    _getHostName: function() {

        console.log('_getHostName');

        testUrl = window.location.hostname || "rally1.rallydev.com";
        testUrlSplit = testUrl.split("/");
        if (testUrlSplit.length === 1) {
            this._rallyHost = "rally1.rallydev.com";
        } else {
            this._rallyHost = testUrlSplit[2];
        }
        this._rallyServer = "https://" + this._rallyHost;
    },

    _initializeDefaultDates: function() {

        console.log('_initializeDefaultDates');

        var me = this;

        me._startDateString = me._dateToISOString(new Date(), false, true);
        me._endDateString = me._dateToISOString(new Date(), false, true);
    },

    _padIntegerToString: function(num, size) {

        console.log('_padIntegerToString');
        var numToPad = Math.abs(num);

        var paddedString = numToPad + "";
        while (paddedString.length < size) {
            paddedString = "0" + paddedString;
        }
        if (num >= 0) {
            return paddedString;
        } else {
            return "-" + paddedString;
        }
    },

    _createStartDateChooserDialog: function() {

        console.log('_createStartDateChooserDialog');

        var me = this;

        if (me._startDateChooserDialog) {
            me._startDateChooserDialog.destroy();
        }

        var label = "Choose Start Commit Date:";
        var defaultDate = new Date();
        var confirmLabel = "Ok";
        var maxDate = new Date();

        me._startDateChooserDialog = Ext.create('ChangesetMover.ChooseDateDialog', {
            calendarLabel: label,
            defaultDate: defaultDate,
            confirmLabel: confirmLabel,
            maxDate: maxDate,
            listeners: {
                confirm: function(dialog, chosendate) {
                    // First strip time from string
                    me._startDateString = me._dateToISOString(chosendate, false, true);

                    // Update Text field
                    me._startDateTextField.setValue(me._startDateString);
                }
            }
        });
    },

    _createEndDateChooserDialog: function() {

        console.log('_createEndDateChooserDialog');

        var me = this;

        if (me._endDateChooserDialog) {
            me._endDateChooserDialog.destroy();
        }

        var label = "Choose End Commit Date:";
        var defaultDate = new Date();
        var confirmLabel = "Ok";

        me._endDateChooserDialog = Ext.create('ChangesetMover.ChooseDateDialog', {
            calendarLabel: label,
            defaultDate: defaultDate,
            confirmLabel: confirmLabel,
            listeners: {
                confirm: function(dialog, chosendate) {
                    // First strip time from string
                    me._endDateString = me._dateToISOString(chosendate, false, true);

                    // Update Text field
                    me._endDateTextField.setValue(me._endDateString);
                }
            }
        });
    },

    _validateTimebox: function() {

        console.log('_validateTimebox');

        var me = this;

        // Get Local time formatted Strings with UTC Offsets
        var startDate_LocalTime_StringFormat = me._getDateStringWithUTCOffset(
            me._startDateString,
            me._startHourString,
            me._startMinuteString
        );
        var endDate_LocalTime_StringFormat = me._getDateStringWithUTCOffset(
            me._endDateString,
            me._endHourString,
            me._endMinuteString
        );

        var now = new Date();
        var nowUTCString = me._dateToISOString(now, true, false);
        var nowUTC = Rally.util.DateTime.fromIsoString(nowUTCString);

        // convert to Date objects (and to UTC in the process)
        var startDateUTC = Rally.util.DateTime.fromIsoString(startDate_LocalTime_StringFormat);
        var endDateUTC = Rally.util.DateTime.fromIsoString(endDate_LocalTime_StringFormat);

        // Do validation checks
        if (startDateUTC >= nowUTC) {
            me._startDateIsInFutureNotify();
            return;
        }

        if (startDateUTC >= endDateUTC) {
            me._startDateIsGTEndDateNotify();
            return;
        }

        // Convert back to ISO Strings, this time - we'll allow conversion to UTC
        var startDateStringUTC = me._dateToISOString(startDateUTC, true, false);
        var endDateStringUTC = me._dateToISOString(endDateUTC, true, false);

        me._startDateStringUTC = startDateStringUTC;
        me._endDateStringUTC = endDateStringUTC;

        // Kick us off - go get the matching Changesets
        me._hydrateData();

    },

    _dateToISOString: function(date, convertToUTC, stripTimePortion) {

        console.log('_dateToISOString');

        if (stripTimePortion) {
            return Rally.util.DateTime.toIsoString( date, convertToUTC ).replace(/T[\W\w]*/,"");
        } else {
            return Rally.util.DateTime.toIsoString( date, convertToUTC );
        }
    },

    _getDateStringWithUTCOffset: function(dateString, hourString, minuteString) {

        console.log('_getDateStringWithUTCOffset');

        var me = this;
        var dateTimeSeparator     = "T";
        var timeDelim             = ":";
        var secondsString         = "00";
        var offsetMinutesString   = "00";
        var offsetHoursString     = me._getUTCOffsetString();

        return dateString + dateTimeSeparator + hourString + timeDelim +
            minuteString + timeDelim + secondsString + offsetHoursString + timeDelim + offsetMinutesString;

    },

    _getUTCOffsetString: function() {
        console.log('_getUTCOffsetString');
        return this._padIntegerToString(parseInt(Ext.Date.format(new Date(), "Z"), 10)/3600, 2);
    },

    _startDateIsInFutureNotify: function() {

        console.log('_startDateIsInFutureNotify');
        var me = this;

        if (me._startDateIsInFutureDialog) {
            me._startDateIsInFutureDialog.destroy();
        }

        me._startDateIsInFutureDialog = Ext.create('Rally.ui.dialog.ConfirmDialog', {
            title: "Start Date/Time is in the Future",
            message: "Please Select Start Date/Time that's in the past.",
            confirmLabel: "Ok",
            listeners: {
                confirm: function(){
                    return;
                }
            }
        });
    },

    _startDateIsGTEndDateNotify: function() {

        console.log('_startDateIsGTEndDateNotify');

        var me = this;

        if (me._startDateIsGTEndDateDialog) {
            me._startDateIsGTEndDate.destroy();
        }

        me._startDateIsGTEndDate = Ext.create('Rally.ui.dialog.ConfirmDialog', {
            title: "Start Date/Time is greater than End Date/Time",
            message: "Please Select Start Date/Time that's before End Date/Time",
            confirmLabel: "Ok",
            listeners: {
                confirm: function(){
                    return;
                }
            }
        });
    },

   _hydrateData: function() {

        console.log('_hydrateData');

        var me = this;

        // Clear out any previous data
        me._artifactChangesetsByChangesetOid = {};
        me._changesetArtifactsByChangesetOid = {};

        // Promise functions
        var getChangesetsPromise = function() {
            return me._getChangesets(me);
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
            getChangesetsPromise,
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

    _getChangesets: function(scope) {

        console.log('_getArtifactChangesetCollection');

        var me = scope;

        var promises = [];
        var deferred = Ext.create('Deft.Deferred');

        promises.push(me._hydrateChangesets(me));

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

    _hydrateChangesets: function(scope) {

        var me = scope;

        console.log('_hydrateChangesetArtifacts');

        var deferred = Ext.create('Deft.Deferred');

        Ext.create('Rally.data.wsapi.Store', {
            model: 'Changeset',
            autoLoad: true,
            fetch: ['ObjectID', 'Name', 'Revision', 'CommitTimestamp', 'Author', 'Artifacts', 'Message'],
            filters: [
                {
                    property: 'CommitTimestamp',
                    operator: '>=',
                    value: me._startDateStringUTC
                },
                {
                    property: 'CommitTimestamp',
                    operator: '<',
                    value: me._endDateStringUTC
                }
            ],
            listeners: {
                load: function(store, records, success) {
                    deferred.resolve(records);
                }
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

        // console.log('_makeGrids');
        var me = scope;
        me._makeChangesetGrid(me);

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
