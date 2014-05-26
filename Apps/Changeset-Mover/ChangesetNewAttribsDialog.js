Ext.define('ArtifactChangesetHelper.ChangesetNewAttribsDialog', {
    extend: 'Rally.ui.dialog.Dialog',
    alias: 'widget.newchangesetattributes',

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
     * @cfg {Boolean}
     * whether to show the Revision field
     */
    showRevisionField: false,

     /**
     * @cfg {String}
     * Current commit message
     */
    currentCommitMessage: '',

    /**
     * @cfg {String}
     * Current commit message
     */
    targetFormattedID: '',

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

    _scmRepositoriesCombobox: null,
    _selectedSCMRepo: null,

    items: [
        {
            xtype: 'component',
            itemId: 'confirmMsg',
            cls: 'confirmMessage'
        },
        {
            xtype: 'rallytextfield',
            fieldLabel: 'Target FormattedID:',
            itemId: 'targetFmtId',
            cls: 'targetFormattedID'
        },
        {
            xtype: 'rallytextfield',
            fieldLabel: 'Current Commit Message:',
            itemId: 'currentCommitMsg',
            cls: 'currentCommitMessage'
        },
        {
            xtype: 'rallytextfield',
            fieldLabel: 'Revision:',
            itemId: 'revisionNbr'
        },
        {
            xtype: 'container',
            itemId: 'scmReposContainer'
        },
        {
            xtype: 'rallytextfield',
            fieldLabel: 'New Commit Message:',
            itemId: 'newCommitMsg'
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

        if (config.currentCommitMessage) {
            this.currentCommitMessage = config.currentCommitMessage;
        }

        if (config.targetFormattedID) {
            this.targetFormattedID = config.targetFormattedID;
        }

        if (config.showRevisionField) {
            this.showRevisionField = config.showRevisionField;
        }

        if (config.scmRepositories) {
            this.scmRepositories = config.scmRepositories;
        }
    },

    initComponent: function() {
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

        this.down('#confirmButton').on('click', this._onConfirm, this);
        this.down('#confirmButton').setText(this.confirmLabel);

        this.down('#cancelButton').on('click', this._onCancel, this);
        this.down('#cancelButton').setText(this.cancelLabel);

        if(this.message) {
            this.down('#confirmMsg').update(this.message);
        } else {
            this.down('#confirmMsg').hide();
        }

        if(this.currentCommitMessage) {
            this.down('#currentCommitMsg').setValue(this.currentCommitMessage);
            this.down('#currentCommitMsg').setDisabled(true);
        } else {
            this.down('#currentCommitMsg').hide();
        }

        if(this.targetFormattedID) {
            this.down('#targetFmtId').setValue(this.targetFormattedID);
            this.down('#targetFmtId').setDisabled(true);
        } else {
            this.down('#targetFmtId').hide();
        }

        if (!this.showRevisionField) {
            this.down('#revisionNbr').hide();
        }

        if (this.scmRepositories) {

            var me = this;

            var scmReposData = [];
            Ext.Array.each(this.scmRepositories, function(scmrepository) {
                scmReposData.push({
                    "name": scmrepository.get('Name'),
                    "_ref": scmrepository.get('_ref')
                });
            });

            var scmReposStore = Ext.create('Ext.data.Store', {
                fields: ['name', '_ref'],
                data: scmReposData
            });

            me._scmRepositoriesCombobox = Ext.create('Ext.form.ComboBox', {
                fieldLabel:   'Choose SCM Repo:',
                store:        scmReposStore,
                queryMode:    'local',
                displayField: 'name',
                valueField:   'type',
                minWidth: 500,
                listeners: {
                    scope: this,
                    'select': me._selectSCMRepo
                }
            });
            this.down('#scmReposContainer').add(me._scmRepositoriesCombobox);
        }
    },

    _selectSCMRepo: function(combobox, records) {
        var me = this;
        me._selectedSCMRepo = records[0];
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

        if (this._scmRepositoriesCombobox) {
            this.fireEvent(
                'confirm',
                this,
                this.down('#newCommitMsg').getValue(),
                this.down('#revisionNbr').getValue(),
                this._selectedSCMRepo
            );
        } else {
            this.fireEvent(
                'confirm',
                this,
                this.down('#newCommitMsg').getValue(),
                this.down('#revisionNbr').getValue()
            );
        }
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