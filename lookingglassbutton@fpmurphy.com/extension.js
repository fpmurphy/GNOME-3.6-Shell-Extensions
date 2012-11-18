//
// Copyright (c) 2012 Finnbarr P. Murphy.  All rights reserved.
//

const Lang = imports.lang;
const St = imports.gi.St;

const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;


const LookingGlassButton = new Lang.Class({
    Name: 'LookingGlassButton',
    Extends: PanelMenu.Button,

    _init: function() {

        this._buttonIcon = new St.Icon({
            icon_name: 'utilities-terminal-symbolic',
            icon_size: 22,
            reactive: true,
            track_hover: true,
            style_class: 'system-status-icon' });

        let menuAlignment = 0.5;
        this.parent(menuAlignment);

        let _box = new St.BoxLayout();
        _box.add_actor(this._buttonIcon);
        this.actor.add_actor(_box);

        this.actor.connect('button-press-event', Lang.bind(this, function () {
           Main.createLookingGlass().toggle();
           return true;
        }));

    },
   
    enable: function() {
        Main.panel._rightBox.insert_child_at_index(this.container, 0);
        this.container.show();
    },

    disable: function() {
        this.container.hide();
    },
});


function init() {
    return new LookingGlassButton();
}
