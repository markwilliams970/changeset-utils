Ext.define('ArtifactChangesetMover.ChangesetNewAttribsDialog', {
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
     * @cfg {String}
     * Current commit message
     */
    currentCommitMessage: '',

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

    items: [
        {
            xtype: 'component',
            itemId: 'confirmMsg',
            cls: 'confirmMessage'
        },
        {
            xtype: 'rallytextfield',
            fieldLabel: 'Current Commit Message:',
            itemId: 'currentCommitMsg',
            cls: 'currentCommitMessage'
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
        } else {
            this.down('#currentCommitMsg').hide();
        }
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
        this.fireEvent('confirm', this, this.down('#newCommitMsg').getValue());
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