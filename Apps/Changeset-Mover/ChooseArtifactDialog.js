Ext.define('ChangesetMover.ChooseArtifactDialog', {
    extend: 'Rally.ui.dialog.Dialog',
    alias: 'widget.chooseartifact',

    requires: [
        'Rally.ui.Button',
        'Rally.ui.dialog.Dialog',
        'Rally.ui.TextField'
    ],

    clientMetrics: {
        beginEvent: 'beforeshow',
        endEvent: 'show',
        description: 'dialog shown'
    },

    width: 350,
    closable: true,
    autoShow: true,
    cls: 'rally-confirm-dialog',

    /**
     * @cfg {String}
     * Title to give to the dialog
     */
    title: '',

    /**
     * @cfg {String}
     * A question to ask the user
     */
    message: '',

    /**
     * @cfg {String}
     * The label for the left button
     */
    confirmLabel: 'Continue',

    /**
     * @cfg {String}
     * The label for the right button
     */
    cancelLabel: 'Cancel',

    /**
     * @cfg {array}
     * The lise of Artifacts from which to select
     */
    artifactList: null,

    /**
     * @cfg {_ref}
     * The selected date
     */
    selectedArtifact: null,

    artifactStore: null,
    artifactComboBox: null,

    items: [
        {
            xtype: 'component',
            itemId: 'confirmMsg',
            cls: 'confirmMessage'
        },
        {
            xtype: 'container',
            itemId: 'artifactComboboxContainer'
        }
    ],

    dockedItems: [
        {
            xtype: 'toolbar',
            dock: 'bottom',
            padding: '10',
            layout: {
                type: 'hbox',
                pack: 'center'
            },
            ui: 'footer',
            items: [
                {
                    xtype: 'rallybutton',
                    cls: 'confirm primary small',
                    itemId: 'confirmButton',
                    userAction: 'clicked yes in dialog'
                },
                {
                    xtype: 'rallybutton',
                    cls: 'cancel secondary small',
                    itemId: 'cancelButton',
                    ui: 'link'
                }
            ]
        }
    ],

    constructor: function(config) {
        this.callParent(arguments);

        if (this.autoCenter) {
            this.scrollListener.saveScrollPosition = true;
        }

        this.artifactList = config.artifactList;

    },

    initComponent: function() {

        var me = this;

        this.callParent(arguments);

        this.addEvents(
            /**
             * @event
             */
            'confirm',

            /**
             * @event
             */
            'cancel'
        );

        var artifactRecords = [];
        Ext.Array.each(this.artifactList, function(artifact) {
            var artifactRecord = {
                "name": artifact.get('FormattedID') + ": " + artifact.get('Name'),
                "value": artifact
            };
            artifactRecords.push(artifactRecord);
        });

        this.artifactStore = Ext.create('Ext.data.Store', {
            fields: ['name', 'value'],
            data: artifactRecords
        });

        this.artifactComboBox = Ext.create('Ext.form.ComboBox', {
            fieldLabel:   'Choose Artifact',
            store:        this.artifactStore,
            queryMode:    'local',
            displayField: 'name',
            valueField:   'type',
            listeners: {
                scope: this,
                'select': function(combobox, records) {
                    this.selectedArtifact = records[0].get('value');
                }
            }
        });

        this.down('#confirmButton').on('click', this._onConfirm, this);
        this.down('#confirmButton').setText(this.confirmLabel);

        this.down('#cancelButton').on('click', this._onCancel, this);
        this.down('#cancelButton').setText(this.cancelLabel);

        if(this.message) {
            this.down('#confirmMsg').update(this.message);
        } else {
            this.down('#confirmMsg').hide();
        }

        this.down('#artifactComboboxContainer').add(this.artifactComboBox);
    },

    show: function() {
        if (this.autoCenter) {
            this._saveScrollPosition();
        }
        this.callParent(arguments);
    },

    close: function() {
        this._onCancel();
    },

    _onConfirm: function() {
        this.fireEvent(
            'confirm',
            this,
            this.selectedArtifact
        );
        this.destroy();
    },

    _onCancel: function() {
        this.fireEvent('cancel', this);
        this.destroy();
    },

    _saveScrollPosition: function() {
        this.savedScrollPosition = {
            xOffset: (window.pageXOffset !== undefined) ? window.pageXOffset : (document.documentElement || document.body.parentNode || document.body).scrollLeft,
            yOffset: (window.pageYOffset !== undefined) ? window.pageYOffset : (document.documentElement || document.body.parentNode || document.body).scrollTop
        };
    }
});