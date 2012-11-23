//
//  Copyright (c) 2012 Finnbarr P. Murphy.  All rights reserved.
//
//  Version: 3.6.0
//
//  License: GPLv2
//

const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Soup = imports.gi.Soup;
const Main = imports.ui.main;
const ModalDialog = imports.ui.modalDialog;
const PanelMenu = imports.ui.panelMenu;
const Cairo = imports.cairo;
const DBus = imports.dbus;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Signals = imports.signals;

const Gettext = imports.gettext.domain('gnome-shell');
const _ = Gettext.gettext;

const KPH2MPH = 0.62137;
const MM2INCH = 0.03937;
const ICON_SIZE = 16;

// Preferences
const SHOW_OBSERVATION_TIME = true;
const EXTENSION_PREFS = '{ "apikey": "NOKEY", "place": "NOWHERE", "interval": "600", "units": "0" }';

// D-Bus support
const EXTENSION_VERSION = '3.6.0';
const EXTENSION_PATH = '/org/gnome/shell/extensions/weather';
const EXTENSION_IFACE = 'org.gnome.shell.extensions.weather';
const PrefsDialogIface = {
    name: EXTENSION_IFACE,
    properties: [{ name: 'ExtensionVersion', signature: 's', access: 'read' },
                 { name: 'WeatherApiKey', signature: 's', access: 'readwrite' },
                 { name: 'WeatherLocation', signature: 's', access: 'readwrite' },
                 { name: 'WeatherInterval', signature: 's', access: 'readwrite' },
                 { name: 'WeatherUnits', signature: 's', access: 'readwrite' }]
};

const _httpSession = new Soup.SessionAsync();


const UnitsSwitch = new Lang.Class ({
    Name: 'UnitsSwitch',

    _init: function(state) {
        this.actor = new St.Bin({ style_class: 'weather-toggle-switch-box' });
        this.actor.add_style_class_name("weather-toggle-switch");
        if (state)
            this.actor.add_style_pseudo_class('checked');
        else
            this.actor.remove_style_pseudo_class('checked');
        this.state = state;
    },
});


const PrefsDialog = new Lang.Class ({
    Name: 'PrefsDialog',
    Extends: ModalDialog.ModalDialog,

    ExtensionVersion: EXTENSION_VERSION,

    _init: function(path) {
        ModalDialog.ModalDialog.prototype._init.call(this, { styleClass: 'weather-dialog' });

        this._path = path;

        this._prefs = null;
        if (!this.readprefs(this._path))
            this._prefs = JSON.parse(EXTENSION_PREFS);

        // D-Bus support
        DBus.session.proxifyObject(this, EXTENSION_IFACE, EXTENSION_PATH);
        DBus.session.exportObject(EXTENSION_PATH, this);
        DBus.session.acquire_name(EXTENSION_IFACE, 0, null, null);

        let box = new St.BoxLayout({style_class: 'weather-dialog-content-box' });
        let leftBox = new St.BoxLayout({vertical: true, style_class: 'weather-dialog-content-box-left'});
        let rightBox = new St.BoxLayout({vertical: true, style_class: 'weather-dialog-content-box-right'});

        let label = new St.Label({ style_class: 'weather-dialog-label'});
        label.set_text(_("World Weather Online API Key "));
        leftBox.add(label, { x_align: St.Align.START, x_fill: true, x_expand: true });
        this._apikeyEntry = new St.Entry({ style_class: 'weather-dialog-entry', can_focus: true });
        rightBox.add(this._apikeyEntry, { x_align: St.Align.END, x_fill: false, x_expand: false });

        label = new St.Label({ style_class: 'weather-dialog-label'});
        label.set_text(_("Forecast Location "));
        leftBox.add(label, {x_align: St.Align.START, x_fill: true, x_expand: true});
        this._placeEntry = new St.Entry({style_class: 'weather-dialog-entry', can_focus: true});
        rightBox.add(this._placeEntry, {x_align: St.Align.END, x_fill: false, x_expand: false});

        label = new St.Label({ style_class: 'weather-dialog-label'});
        label.set_text(_("Forecast Update Interval (Secs) "));
        leftBox.add(label, {x_align: St.Align.START, x_fill: true, x_expand: true});
        this._intervalEntry = new St.Entry({style_class: 'weather-dialog-entry', can_focus: true});
        rightBox.add(this._intervalEntry, {x_align: St.Align.END, x_fill: false, x_expand: false});

        label = new St.Label({ style_class: 'weather-dialog-label'});
        label.set_text(_("Measurement Units "));
        leftBox.add(label, {x_align: St.Align.START, x_fill: true, x_expand: true});
        let _unitsBin = new St.Bin();
        this._switch = new UnitsSwitch(true);
        _unitsBin.child = this._switch.actor;
        rightBox.add(_unitsBin, {x_align: St.Align.START, x_fill: false, x_expand: false});
        this._switch.actor.can_focus = true;
        this._switch.actor.reactive = true;
        this._switch.actor.connect('key-press-event', Lang.bind(this, this._unitswitch_key));
        this._switch.actor.connect('button-press-event', Lang.bind(this, this._unitswitch_button));

        // packing shim
        label = new St.Label();
        label.set_text(" ");
        leftBox.add(label, {x_align: St.Align.START, x_fill: true, x_expand: true});

        box.add(leftBox);
        box.add(rightBox);
        this.contentLayout.add(box, {y_align: St.Align.START});
     
        this._errorBox = new St.BoxLayout({ style_class: 'weather-dialog-error-box' });
        this.contentLayout.add(this._errorBox, { expand: true });

        let errorIcon = new St.Icon({icon_name: 'dialog-error', 
                                     icon_size: 24, style_class: 'weather-dialog-error-icon'});
        this._errorBox.add(errorIcon, {y_align: St.Align.MIDDLE});

        this._errorMessage = new St.Label({style_class: 'weather-dialog-error-label'});
        this._errorMessage.clutter_text.line_wrap = true;
        this._errorBox.add(this._errorMessage, {expand: true,
                                                y_align: St.Align.MIDDLE,
                                                y_fill: false});
        this._errorBox.hide();

        this.connect('opened', Lang.bind(this, this._onOpened));
    },

    _unitswitch_set: function(state) {
        if (state) {
           this._switch.actor.add_style_pseudo_class('checked');
           this._switch.state = true;
           this._unitsEntry = "1";
       } else {
           this._switch.actor.remove_style_pseudo_class('checked');
           this._switch.state = false;
           this._unitsEntry = "0";
       }
    },

    _unitswitch_key: function(actor, event) {
        let keysym = event.get_key_symbol();
        if (keysym == Clutter.Right) {
           this._unitswitch_set(true);
        } else if (keysym == Clutter.Left) {
           this._unitswitch_set(false);
        }
    },

    _unitswitch_button: function(actor, event) {
        this._switch.actor.grab_key_focus();
        let button = event.get_button();
        if (button == 1) {
           this._unitswitch_set(false);
        } else if (button == 3) {
           this._unitswitch_set(true);
        }
    },

    _onOpened: function() {
        this._apikeyEntry.grab_key_focus();
    },

    _validateAdd: function() {
        let apikey = this._apikeyEntry.clutter_text.get_text();
        if (apikey.toUpperCase() == "NOKEY" || apikey.toUpperCase() == "NOAPIKEY") {
            this._errorMessage.clutter_text.set_text(_('API key cannot be NOKEY or NOAPIKEY!'));
            this._errorBox.show();
            return false;
        }
        if (apikey == "") {
            this._errorMessage.clutter_text.set_text(_('API key cannot be empty!'));
            this._errorBox.show();
            return false;
        }
        let place =  this._placeEntry.clutter_text.get_text();
        if (place.toUpperCase() == "NOWHERE" || place.toUpperCase() == "NOPLACE") {
            this._errorMessage.clutter_text.set_text(_('Location cannot be NOWHERE or NOPLACE!'));
            this._errorBox.show();
            return false;
        }
        if (place == "") {
            this._errorMessage.clutter_text.set_text(_('Location cannot be empty!'));
            this._errorBox.show();
            return false;
        }
        let integer = parseInt(this._intervalEntry.clutter_text.get_text());
        if (integer < 10 || integer > 600) { 
            this._errorMessage.clutter_text.set_text(_('Interval must be between 10 and 600!'));
            this._errorBox.show();
            return false;
        }
        this.close();

        this._prefs.apikey = this._apikeyEntry.clutter_text.get_text();
        this._prefs.place = this._placeEntry.clutter_text.get_text();
        this._prefs.interval = this._intervalEntry.clutter_text.get_text();
        this._prefs.units = this._unitsEntry;
        this.write_prefs(this._path);

        return true;
    },

    open: function(timestamp) {
        this._apikeyEntry.clutter_text.set_text(this._prefs.apikey);
        this._placeEntry.clutter_text.set_text(this._prefs.place);
        this._intervalEntry.clutter_text.set_text(this._prefs.interval);
        this._unitsEntry = this._prefs.units;
        this._errorBox.hide();

        this.setButtons([
            {
                label: _("Save"),
                action: Lang.bind(this, this._validateAdd)
            },
            {
                label: _("Cancel"),
                key: Clutter.KEY_Escape,
                action: Lang.bind(this, function(){
                    this.close();
                })
            }
        ]);

        ModalDialog.ModalDialog.prototype.open.call(this, timestamp);
    },

    readprefs: function(path) {
        let dir = Gio.file_new_for_path(path);
        let prefsFile = dir.get_child('prefs.json');
        if (!prefsFile.query_exists(null)) {
            return false;
        }
        let prefsContent;
        try {
            prefsContent = Shell.get_file_contents_utf8_sync(prefsFile.get_path());
        } catch (e) {
            global.log('Failed to load prefs.json: ' + e);
            return false;
        }
        this._prefs =  JSON.parse(prefsContent);
        return true;
    },

    write_prefs: function(path) {
        let f = Gio.file_new_for_path(path + '/prefs.json');
        let raw = f.replace(null, false, Gio.FileCreateFlags.NONE, null);
        let out = Gio.BufferedOutputStream.new_sized(raw, 4096);
        Shell.write_string_to_stream(out, JSON.stringify(this._prefs));
        out.close(null);
        this.emit('prefs-changed');
    },

    get_apikey: function() {
        return this._prefs.apikey;
    },

    get_place: function() {
        return this._prefs.place;
    },

    get_interval: function() {
        return this._prefs.interval;
    },

    get_units: function() {
        return this._prefs.units
    },

    get WeatherApiKey() {
        return this._prefs.apikey;
    },

    set WeatherApiKey(apikey) {
        this._prefs.apikey = apikey;
    },

    get WeatherLocation() {
        return this._prefs.place;
    },

    set WeatherLocation(place) {
        this._prefs.place = place;
        this.write_prefs(this._path);
    },

    get WeatherInterval() {
        return this._prefs.interval;
    },

    set WeatherInterval(interval) {
        this._prefs.interval = interval;
        this.write_prefs(this._path);
    },

    get WeatherUnits() {
        return this._prefs.units;
    },

    set WeatherUnits(units) {
        this._prefs.units = units;
        this.write_prefs(this._path);
    }
});
Signals.addSignalMethods(PrefsDialog.prototype);
DBus.conformExport(PrefsDialog.prototype, PrefsDialogIface);


const WeatherButton = new Lang.Class({
    Name: 'WeatherButton',
    Extends: PanelMenu.Button,

    _init: function(path) {

        this._weatherInfo =  null;
        this._currentWeather = null;
        this._futureWeather = null;
        this._path = path;

        let menuAlignment = 0.5;
        this.parent(menuAlignment);

        // preferences
        this._prefsDialog = new PrefsDialog(this._path);
        this._prefsDialog.connect('prefs-changed', Lang.bind(this, function() {
           this._getWeatherInfo(false);
        }));

        if (Soup.Session.prototype.add_feature != null)
              Soup.Session.prototype.add_feature.call(_httpSession,
                 new Soup.ProxyResolverDefault());

        this._weatherButton  = new St.BoxLayout({ style_class: 'weather-status'});
        this._weatherIconBox = new St.Bin({ style_class: 'weather-status-icon'});
        this._weatherIcon    = new St.Icon({icon_name: 'view-refresh-symbolic',
                                            icon_size: 22,
                                            reactive: true,
                                            track_hover: true,
                                            style_class: 'system-status-icon' });
        this._weatherTemp = new St.Label({text: "   ", style_class: 'weather-status-text' });

        this._weatherIconBox.add_actor(this._weatherIcon);
        this._weatherButton.add_actor(this._weatherIconBox);
        this._weatherButton.add_actor(this._weatherTemp);
        this.actor.add_actor(this._weatherButton);

        this.weatherBox = new St.BoxLayout({ vertical: true, style_class: 'weather-box' });
        this.weatherBox.hide();
        this.menu.addActor(this.weatherBox);

        this._getWeatherInfo(false);
        this.menu.connect('open-state-changed', Lang.bind(this, function(menu, isOpen) {
            this._displayWeatherPanel();
        }));
        this.actor.connect('button-press-event', Lang.bind(this, this._onButtonPressEvent));
    },
   
    enable: function() {
        Main.panel._centerBox.insert_child_at_index(this.container, 1);
        Main.panel.menuManager.addMenu(this.menu);
        this.container.show();
        this._mainloop = Mainloop.timeout_add(2000, Lang.bind(this, function() {
            this._getWeatherInfo(true);
        }));
    },

    disable: function() {
        this.container.hide();
        Mainloop.source_remove(this._mainloop);
    },

    _onButtonPressEvent: function (actor, event) {
        if (this._prefsDialog.get_apikey() == "NOKEY" || this._prefsDialog.get_place() == "NOWHERE") {
            this._prefsDialog.open(event.get_time());
            return true;
        }
        if (event.get_button() == 1) {
            if (this.menu.isOpen) {
                this._displayWeatherPanel();
            }
        }
        if (event.get_button() == 3) {
            this._prefsDialog.open(event.get_time());
        }
        return true;
    },

    // retrieve the weather data using SOAP
    _loadJSON: function(url, callback) {
        let here = this;
        let message = Soup.Message.new('GET', url);
        _httpSession.queue_message(message, function(session, message) {
            let jObj = JSON.parse(message.response_body.data);
            callback.call(here, jObj['data']);
        });
    },

    // retrieve a weather icon image
    _getIconImage: function(iconpath) {
         let icon_file = this._path + "/icons/" +
                         iconpath[0].value.match(/\/wsymbols01_png_64\/(.*)/)[1];
         let file = Gio.file_new_for_path(icon_file);
         let icon_uri = file.get_uri();

         return St.TextureCache.get_default().load_uri_async(icon_uri, 64, 64);
    },

    // get the weather information every interval
    _getWeatherInfo: function(mode) {
        this._loadJSON('http://free.worldweatheronline.com/feed/weather.ashx?q=' +
        this._prefsDialog.get_place() + '&format=json&num_of_days=5&key=' +
        this._prefsDialog.get_apikey(), function(weatherinfo) {
            this._weatherInfo = weatherinfo;
            let curr = weatherinfo.current_condition;
            let icon_path = this._path + "/icons/" +
                            curr[0].weatherIconUrl[0].value.match(/\/wsymbols01_png_64\/(.*)/)[1];
            let file = Gio.file_new_for_path(icon_path);
            let icon_uri = file.get_uri();
            this._weatherIconBox.child = St.TextureCache.get_default().load_uri_async(icon_uri, 22, 22);
            let munits = this._prefsDialog.get_units();
            this._weatherTemp.text = ( munits > 0 ? curr[0].temp_C + " \u00B0C" : curr[0].temp_F + " \u00B0F");
        });

        if (mode) {
             Mainloop.timeout_add_seconds(this._prefsDialog.get_interval(),
                 Lang.bind(this, function() { this._getWeatherInfo(true) }));
        }
    },


    // paint hotizonal dotted line
    _onHorzSepRepaint: function(area) {
        let cr = area.get_context();
        let themeNode = area.get_theme_node();
        let [width, height] = area.get_surface_size();
        let stippleColor = themeNode.get_color('-separator-color');
        let stippleWidth = themeNode.get_length('-separator-width');
        let y = Math.floor(height/2) + 0.5;

        cr.setDash([1, 2], 0);
        cr.setLineWidth(stippleWidth);
        Clutter.cairo_set_source_color(cr, stippleColor);
        cr.moveTo(15, y);
        cr.lineTo(width - 15, y);
        cr.stroke();
    },

    _displayWeatherPanel: function() {
        let weather = this._weatherInfo;          
        let request = weather.request;
        let curr = weather.current_condition;
        let weathers = weather.weather;
        let desc = curr[0].weatherDesc;            
        let munits = this._prefsDialog.get_units();

        let currTemp = ( munits > 0 ? curr[0].temp_C + " \u00B0C" : curr[0].temp_F + " \u00B0F"); 
        let currLocation = request[0].query;
        currLocation = currLocation.split(',')[0];  // trim off everything after first comma 
        let comment = desc[0].value;

        // current weather data
        let currHumidity = new St.Label({ text: (curr[0].humidity + '%') });
        let currPressure = new St.Label({ text: (munits > 0 ? curr[0].pressure + ' mm' :
                                                (curr[0].pressure * MM2INCH).toFixed(2) + '"') });
        let currWind = new St.Label({ text: (curr[0].winddir16Point + ' ' + 
                                     (munits > 0 ? curr[0].windspeedKmph + ' kph' : 
                                      curr[0].windspeedMiles + ' mph')) });
        let currVisibility = new St.Label({ text: (munits > 0 ? curr[0].visibility + ' km' : 
                                            parseInt(curr[0].visibility * KPH2MPH) + ' miles') });
        let currCloudCover = new St.Label({ text: (curr[0].cloudcover +'%') });
        let currPercipitation = new St.Label({ text: (munits > 0 ? curr[0].precipMM + ' mm' : 
                                               (curr[0].precipMM * MM2INCH).toFixed(2) + '"') });

        // destroy any previous components 
        this.weatherBox.get_children().forEach(function (actor) { actor.destroy(); });

        this._locationWeather = new St.BoxLayout({ style_class: 'weather-location-box'});
        let _observationBox   = new St.BoxLayout({ style_class: 'weather-current-box'});
        this._currentWeather  = new St.BoxLayout({ style_class: 'weather-current-box'});
        this._futureWeather   = new St.BoxLayout({ style_class: 'weather-forecast-box'});

        // horizontal separators
        let _horzSep1 = new St.DrawingArea({ style_class: 'weather-horizontal-separator'});
        _horzSep1.connect('repaint', Lang.bind(this, this._onHorzSepRepaint));
        let _horzSep2 = new St.DrawingArea({ style_class: 'weather-horizontal-separator'});
        _horzSep2.connect('repaint', Lang.bind(this, this._onHorzSepRepaint));

        this.weatherBox.add_actor(this._locationWeather, { expand: false, x_fill: false });
        this.weatherBox.add(_horzSep1);
        this.weatherBox.add_actor(_observationBox, { expand: false, x_fill: false });
        this.weatherBox.add_actor(this._currentWeather, { expand: false, x_fill: false });
        this.weatherBox.add(_horzSep2);
        this.weatherBox.add_actor(this._futureWeather, { expand: false, x_fill: false });

        // set up location box
        let _lbox = new St.BoxLayout({ style_class: 'weather-location-innerbox'});
        let _caption = new St.BoxLayout({ style_class: 'weather-location-caption-box'});
        _caption.add_actor(new St.Label({ text: _('Location:'),
                                          style_class: 'weather-location-caption'}));
        let _value = new St.BoxLayout({ style_class: 'weather-location-value-box'});
        _value.add_actor(new St.Label({ text: currLocation,
                                        style_class: 'weather-location-value' }));
        _lbox.add_actor(_caption);
        _lbox.add_actor(_value);
        this._locationWeather.add_actor(_lbox);

        // current temperature
        let _tbox    = new St.BoxLayout({ style_class: 'weather-temperature-innerbox'});
        let _caption = new St.BoxLayout({ style_class: 'weather-temperature-caption-box'});
        let _value   = new St.BoxLayout({ style_class: 'weather-temperature-value-box'});
        _caption.add_actor(new St.Label({ text: _('  Temp:'),
                                          style_class: 'weather-temperature-caption'}));
        _value.add_actor(new St.Label({ text: currTemp,
                                        style_class: 'weather-temperature-value' }));
        _tbox.add_actor(_caption);
        _tbox.add_actor(_value);
        this._locationWeather.add_actor(_tbox);

        // Observation date and time (Note - this is the date/time at observation location!) 
        if (SHOW_OBSERVATION_TIME) {
            _observationBox.add_actor(new St.Label({ style_class: 'weather-observation',
                                                     text: _('Observation time at location: ') + 
                                                           weathers[0].date + " " + 
                                                           curr[0].observation_time }));
        }
 
        // set up middle left box 
        let boxLeft    = new St.BoxLayout({ style_class: 'weather-current-databox-left'});
        let lbCaptions = new St.BoxLayout({ vertical: true, 
                                            style_class: 'weather-current-databox-captions'});
        let lbValues   = new St.BoxLayout({ vertical: true, 
                                            style_class: 'weather-current-databox-values'});
        boxLeft.add_actor(lbCaptions);
        boxLeft.add_actor(lbValues);
        lbCaptions.add_actor(new St.Label({ text: _('Visibility:'), 
                                            style_class: 'weather-captions-top'}));
        lbCaptions.add_actor(new St.Label({ text: _('Humidity:'), 
                                            style_class: 'weather-captions-bottom'}));
        lbValues.add_actor(currVisibility);
        lbValues.add_actor(currHumidity);

        // set up middle middle box 
        let boxMiddle  = new St.BoxLayout({ style_class: 'weather-current-databox-middle'});
        let mbCaptions = new St.BoxLayout({ vertical: true, 
                                            style_class: 'weather-current-databox-captions'});
        let mbValues   = new St.BoxLayout({ vertical: true, 
                                            style_class: 'weather-current-databox-values'});
        boxMiddle.add_actor(mbCaptions);
        boxMiddle.add_actor(mbValues);
        mbCaptions.add_actor(new St.Label({ text: _('Pressure:'), 
                                            style_class: 'weather-captions-top'}));
        mbCaptions.add_actor(new St.Label({ text: _('Wind:'), 
                                            style_class: 'weather-captions-bottom'}));
        mbValues.add_actor(currPressure);
        mbValues.add_actor(currWind);
        
        // set up middle right box 
        let boxRight = new St.BoxLayout({ style_class: 'weather-current-databox-right'});
        rbCaptions   = new St.BoxLayout({ vertical: true, 
                                          style_class: 'weather-current-databox-captions'});
        rbValues     = new St.BoxLayout({ vertical: true, 
                                          style_class: 'weather-current-databox-values'});
        boxRight.add_actor(rbCaptions);
        boxRight.add_actor(rbValues);
        rbCaptions.add_actor(new St.Label({ text: _('Cloud Cover:'), 
                                            style_class: 'weather-captions-top'}));
        rbCaptions.add_actor(new St.Label({ text: _('Precipitation:'), 
                                            style_class: 'weather-captions-bottom'}));
        rbValues.add_actor(currCloudCover);
        rbValues.add_actor(currPercipitation);

        this._currentWeather.add_actor(boxLeft);
        this._currentWeather.add_actor(boxMiddle);
        this._currentWeather.add_actor(boxRight);
        
        // now set up the 5 day forecast area
        for (let i = 0; i < weathers.length; i++) {
            let weather = weathers[i];
            let foreWeather = {};

            // forecast data
            let desc = weather.weatherDesc;
            let t_low = (munits > 0 ?  weather.tempMinC : weather.tempMinF);
            let t_high = (munits > 0 ?  weather.tempMaxC : weather.tempMaxF);
            let foreDate = this._getDate(i, weather.date);

            foreWeather.Icon = this._getIconImage(weather.weatherIconUrl);
            foreWeather.Day = new St.Label({ style_class: 'weather-forecast-day',
                                             text: foreDate });
            foreWeather.Temperature = new St.Label({ style_class: 'weather-forecast-temperature',
                                     text: (t_low + ' - ' + t_high + (munits > 0 ? 'C' : 'F')) });

            let dataBox = new St.BoxLayout({vertical: true, 
                                            style_class: 'weather-forecast-databox'});
            dataBox.add_actor(foreWeather.Day, { x_align: St.Align.START, 
                                                 expand: false, 
                                                 x_fill: false });
            dataBox.add_actor(foreWeather.Temperature, { x_align: St.Align.START, 
                                                         expand: false, 
                                                         x_fill: false });
            let iconBox = new St.BoxLayout({style_class: 'weather-forecast-icon'});
            iconBox.add_actor(foreWeather.Icon);

            this._futureWeather.add_actor(iconBox);
            this._futureWeather.add_actor(dataBox);
        }

        this.weatherBox.show();
    },

    // get day-of-week for a date
    _getDate: function(index, dateStr) {
         let dowString = [ _('Monday'),  _('Tuesday'),  _('Wednesday'),  _('Thursday'),
                           _('Friday'),  _('Saturday'),  _('Sunday') ];

         let tmpDate = new Date(dateStr);
         let tmpDOW  = tmpDate.getDay();

         return dowString[tmpDOW];
    }

});


function init(metadata) {
    return new WeatherButton(metadata.path);
}
