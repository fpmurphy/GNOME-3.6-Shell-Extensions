//
//  Copyright 2012 (c) Finnbarr P. Murphy.  All rights reserved.
//

const Lang = imports.lang;
const Main = imports.ui.main;

const START_OF_WEEK = 2;     // USA: Sunday = 1, Monday = 2, etc.  


const StartOfWeek =  new Lang.Class ({
    Name: 'StartOfWeek',

    _init: function() {
        this._calendar = Main.panel.statusArea.dateMenu._calendar;
        this._weekStart = this._calendar._weekStart;
    },

    enable: function() {
        if ( START_OF_WEEK > 1 && START_OF_WEEK < 8 ) {
            this._calendar._weekStart = (START_OF_WEEK - 1);
            this._calendar._buildHeader();
        }   
    },

    disable: function() {
        if (this._calendar._weekStart != this._weekStart) {
            this._calendar._weekStart = this._weekStart;
            this._calendar._buildHeader();
        }
    }
});


function init() {
    return new StartOfWeek()
}
