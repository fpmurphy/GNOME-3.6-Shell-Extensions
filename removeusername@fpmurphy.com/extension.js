//
//  Copyright (c) 2012  Finnbarr P. Murphy.  All rights reserved.
//

const Lang = imports.lang;
const Main = imports.ui.main;


const RemoveUsername = new Lang.Class ({
      Name: 'RemoveUsername',

    _init: function() {
	this._username = Main.panel.statusArea.userMenu._name;
    },

    enable: function() {
        this._username.hide();
    },

    disable: function() {
        this._username.show();
    }
});


function init() {
    return new RemoveUsername();
}
