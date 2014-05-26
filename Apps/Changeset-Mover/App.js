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

    _startDateString: null,
    _endDateString: null,

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

        // Initialize default values for start and end dates
        me._initializeDefaultDates();

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

        console.log(startDateStringUTC);
        console.log(endDateStringUTC);
    },

    _dateToISOString: function(date, convertToUTC, stripTimePortion) {

        if (stripTimePortion) {
            return Rally.util.DateTime.toIsoString( date, convertToUTC ).replace(/T[\W\w]*/,"");
        } else {
            return Rally.util.DateTime.toIsoString( date, convertToUTC );
        }
    },

    _getDateStringWithUTCOffset: function(dateString, hourString, minuteString) {

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
        return this._padIntegerToString(parseInt(Ext.Date.format(new Date(), "Z"), 10)/3600, 2);
    },

    _startDateIsInFutureNotify: function() {

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
    }

});
