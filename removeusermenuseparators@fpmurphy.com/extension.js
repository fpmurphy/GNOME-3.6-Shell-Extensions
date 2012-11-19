//
//  Copyright (c) 2012  Finnbarr P. Murphy.  All rights reserved.
//

const Lang = imports.lang;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;


const RemoveSeparators = new Lang.Class ({
    Name: 'RemoveSeparators',

    _init: function () {
       this.userMenu = Main.panel.statusArea.userMenu.menu;
       this.oldFunc = this.userMenu._updateSeparatorVisibility;
    },

    enable: function() {
       this.userMenu._updateSeparatorVisibility = this._updateSeparatorVisibility;
       let children = this.userMenu._getMenuItems();
       for (let i = 0; i < children.length; i++) {
           let item = children[i];
           if (item instanceof PopupMenu.PopupSeparatorMenuItem) {
              item.actor.hide();
           }
       }            
    },

    disable: function() {
       this.userMenu._updateSeparatorVisibility = this.oldFunc;
       let children = this.userMenu._getMenuItems();
       for (let i = 0; i < children.length; i++) {
           let item = children[i];
           if (item instanceof PopupMenu.PopupSeparatorMenuItem) {
              item.actor.show();
           }
       }            
    },

    _updateSeparatorVisibility: function(menuItem) {
        menuItem.actor.hide();
    },

});


function init(extensionMeta) {
    return new RemoveSeparators();
}
