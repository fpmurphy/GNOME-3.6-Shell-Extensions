//
// Copyright (c) 2012 Finnbarr P. Murphy. All rights reserved.
//

const Lang = imports.lang;
const Main = imports.ui.main;

const NoA11y = new Lang.Class ({
    Name: 'NoA11y', 

    _init: function() { },

    enable: function() {
        Main.panel.statusArea.a11y.actor.hide();
    },

    disable: function() {
        Main.panel.statusArea.a11y.actor.show();
    },
});


function init() {
    return new NoA11y();
}
