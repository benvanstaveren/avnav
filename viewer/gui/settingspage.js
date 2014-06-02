/**
 * Created by Andreas on 01.06.2014.
 */
goog.provide('avnav.gui.Settingspage');
goog.require('avnav.gui.Handler');
goog.require('avnav.gui.Page');


/**
 *
 * @constructor
 */
avnav.gui.Settingspage=function(){
    //a collection of all items, key is the name, value a function to get the current value
    this.allItems={};
    goog.base(this,'settingspage');
};
goog.inherits(avnav.gui.Settingspage,avnav.gui.Page);

/**
 * the local init called from the base class when the page is instantiated
 */
avnav.gui.Settingspage.prototype.localInit=function(){
    var self=this;
    $('.avn_setting').each(function(idx,el){
        var name=$(el).attr('avn_name');
        self.createSettingHtml(self.gui.properties.getDescriptionByName(name),el);
    });
};
/**
 * create the html for a settings item
 * @private
 * @param {avnav.util.Property} descr
 * @param el
 */
avnav.gui.Settingspage.prototype.createSettingHtml=function(descr,el){
    if (!(descr instanceof avnav.util.Property)) return;
    if (descr.type == avnav.util.PropertyType.CHECKBOX){
        var value=this.gui.properties.getValue(descr);
        var html='<label>'+descr.label;
        html+='<input type="checkbox" class="avn_settings_checkbox" avn_name="'+name+'"';
        if (value) html+="checked";
        html+='></input></label>';
        this.allItems[descr.completeName]= {
            read: function () {
                return $(el).find('input').is(':checked');
            },
            write: function (value) {
                $(el).find('input').prop('checked', value);
            }
        };
    }
    $(el).html(html);
    //$(el).find('input').on('change',{name:descr.completeName},function(evt){alert("change "+evt.data.name);});
};

/**
 * @private
 * read all data and update the elements
 */
avnav.gui.Settingspage.prototype.readData=function(){
    for (var idx in this.allItems){
        var value=this.gui.properties.getValueByName(idx);
        this.allItems[idx].write(value);
    }
};

avnav.gui.Settingspage.prototype.showPage=function(options){
    if (!this.gui) return;
    this.readData();
};


avnav.gui.Settingspage.prototype.hidePage=function(){

};




//-------------------------- Buttons ----------------------------------------
/**
 * cancel settings page (go back to main)
 * @private
 */
avnav.gui.Settingspage.prototype.btnSettingsCancel=function(button,ev){
    log("SettingsCancel clicked");
    this.gui.showPage('mainpage');
};

/**
 * activate settings and go back to main
 * @private
 */
avnav.gui.Settingspage.prototype.btnSettingsOK=function(button,ev){
    log("SettingsOK clicked");
    var txt="";
    for (var idx in this.allItems){
        txt+=","+idx+":"+this.allItems[idx].read();
    }
    alert("Result: "+txt);
    this.gui.showPage('mainpage');
};

(function(){
    //create an instance of the status page handler
    var page=new avnav.gui.Settingspage();
}());


