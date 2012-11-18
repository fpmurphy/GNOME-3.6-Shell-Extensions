//
// Copyright (c) 2012 Finnbarr P. Murphy.  All rights reserved.
//

const Lang = imports.lang;
const St = imports.gi.St;

const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;


const DemoButton = new Lang.Class({
    Name: 'DemoButton',
    Extends: PanelMenu.Button,

    _init: function() {

        this._demoButtonIcon = new St.Icon({
            icon_name: 'view-refresh-symbolic',
            icon_size: 22,
            reactive: true,
            track_hover: true,
            style_class: 'demobutton-icon' });

        let menuAlignment = 0.5;
        this.parent(menuAlignment);

        let topBox = new St.BoxLayout();
        topBox.add_actor(this._demoButtonIcon);
        this.actor.add_actor(topBox);
        this._topBox = topBox;

        let item = new PopupMenu.PopupMenuItem("Hello");
        this.menu.addMenuItem(item);
        item = new PopupMenu.PopupMenuItem("Goodbye");
        this.menu.addMenuItem(item);
        Main.panel.menuManager.addMenu(this.menu);
    },
   
    enable: function() {
        Main.panel._centerBox.insert_child_at_index(this.container, 1);
        this.container.show();
    },

    disable: function() {
        this.container.hide();
    },
});


function init() {
    return new DemoButton();
}
