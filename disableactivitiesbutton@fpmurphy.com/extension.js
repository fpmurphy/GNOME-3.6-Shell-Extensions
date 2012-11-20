//
//  Copyright (c) 2012  Finnbarr P. Murphy.  All rights reserved.
//

const Lang = imports.lang;
const Main = imports.ui.main;


const DisableActivitiesButton = new Lang.Class ({
    Name: 'DisableActivitiesButton',

    _init: function() {
        indicator = Main.panel.statusArea.activities;
    },

    enable: function() {
        if (indicator != null)
            indicator.container.hide();
    },

    disable: function() {
        if (indicator != null)
            indicator.container.show();
    },

});


function init() {
    return new DisableActivitiesButton();
}
