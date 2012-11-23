//
//  Copyright (c) 2012 Finnbarr P. Murphy.  All rights reserved.
//

const St = imports.gi.St;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Lang = imports.lang;
const Gio = imports.gi.Gio;
const BoxPointer = imports.ui.boxpointer;

const Gettext = imports.gettext.domain('gnome-shell-extensions');
const _ = Gettext.gettext;

const SCREENSAVER_SCHEMA = 'org.gnome.desktop.screensaver';
const LOCK_ENABLED_KEY = 'lock-enabled';


const PowerOptions =  new Lang.Class ({
    Name: 'PowerOptions', 

    _init: function () {
        this.userMenu = Main.panel.statusArea.userMenu;

        this.poweroffMenuItem = null;
        this.hibernateMenuItem = null;
        this.suspendMenuItem = null;

        this.suspendSignalId = 0
        this.hibernateSignalId = 0;
    },

    enable: function() {
        let children = this.userMenu.menu._getMenuItems();

        let index = 0;
        for (let i = children.length - 1; i >= 0; i--) {
            if (children[i] == this.userMenu._suspendOrPowerOffItem) {
                 children[i].destroy();
                 index = i;
                 break;
            }
        }
        if (index == 0) return;

        this.suspendMenuItem = new PopupMenu.PopupMenuItem(_("Suspend"));
        this.suspendMenuItem.connect('activate', Lang.bind(this.userMenu, this.onSuspendActivate));
        this.suspendSignalId = this.userMenu._upClient.connect('notify::can-suspend', 
             Lang.bind(this.userMenu, this.updateSuspend, this.suspendMenuItem));
        this.updateSuspend(this.userMenu._upClient, null, this.suspendMenuItem);
        this.userMenu.menu.addMenuItem(this.suspendMenuItem, index);

        this.hibernateMenuItem = new PopupMenu.PopupMenuItem(_("Hibernate"));
        this.hibernateMenuItem.connect('activate', Lang.bind(this.userMenu, this.onHibernateActivate));
        this.hibernateSignalId = this.userMenu._upClient.connect('notify::can-hibernate', 
             Lang.bind(this.userMenu, this.updateHibernate, this.hibernateMenuItem));
        this.updateHibernate(this.userMenu._upClient, null, this.hibernateMenuItem);
        this.userMenu.menu.addMenuItem(this.hibernateMenuItem, index+1);

        this.poweroffMenuItem = new PopupMenu.PopupMenuItem(_("Power Off"));
        this.poweroffMenuItem.actor.add_style_pseudo_class('alternate');
        this.poweroffMenuItem.connect('activate', Lang.bind(this.userMenu, function() {
             this._session.ShutdownRemote();
        }));
        this.userMenu.menu.addMenuItem(this.poweroffMenuItem, index+2);

        this.userMenu._suspendOrPowerOffItem = null;
    },

    disable: function() {
        let children = this.userMenu.menu._getMenuItems();

        let index = 0;
        for (let i = children.length - 1; i >= 0; i--) {
            if (children[i] == this.suspendMenuItem) {
               index = i;
               break;
            }
        }
        if (index == 0) return;

        this.userMenu._upClient.disconnect(this.suspendSignalId);
        this.userMenu._upClient.disconnect(this.hibernateSignalId);

        this.suspendMenuItem.destroy();
        this.hibernateMenuItem.destroy();
        this.poweroffMenuItem.destroy();

        let menuItem = new PopupMenu.PopupAlternatingMenuItem("", "");
        this.userMenu._suspendOrPowerOffItem = menuItem;
        this.userMenu.menu.addMenuItem(menuItem, index);
        menuItem.connect('activate',
             Lang.bind(this.userMenu, this.userMenu._onSuspendOrPowerOffActivate));
        this.userMenu._updateSuspendOrPowerOff();
    },

    updateSuspend: function(object, pspec, item) {
        item.actor.visible = object.get_can_suspend();
    },

    updateHibernate: function(object, pspec, item) {
        item.actor.visible = object.get_can_hibernate();
    },

    onSuspendActivate: function() {
        Main.overview.hide();
        if (Main.panel.statusArea.userMenu._screenSaverSettings.get_boolean(LOCK_ENABLED_KEY)) {
            let tmpId = Main.screenShield.connect('lock-screen-shown', Lang.bind(this, function() {
                Main.screenShield.disconnect(tmpId);
                this._upClient.suspend_sync(null);
            }));

            this.menu.close(BoxPointer.PopupAnimation.NONE);
            Main.screenShield.lock(true);
        } else 
            this._upClient.suspend_sync(null);
    },

    onHibernateActivate: function() {
        Main.overview.hide();

        if (Main.panel.statusArea.userMenu._screenSaverSettings.get_boolean(LOCK_ENABLED_KEY)) {
            let tmpId = Main.screenShield.connect('lock-screen-shown', Lang.bind(this, function() {
                Main.screenShield.disconnect(tmpId);
                this._upClient.hibernate_sync(null);
            }));

            Main.screenShield.lock(true);
        } else  
            this._upClient.hibernate_sync(null);
    },

});


function init() {
    return new PowerOptions();
}
