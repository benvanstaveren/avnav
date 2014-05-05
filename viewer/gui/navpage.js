/**
 * Created by andreas on 02.05.14.
 */
goog.provide('avnav.gui.Navpage');
goog.require('avnav.gui.Handler');
goog.require('avnav.gui.Page');

/**
 *
 * @constructor
 */
avnav.gui.Navpage=function(){
    goog.base(this,'navpage');
    /** @private */
    this.options_=null;
    var self=this;
    $(document).on(avnav.nav.NavObject.GPS_EVENT, function(ev,evdata){
       self.gpsEvent(evdata);
    });
};
goog.inherits(avnav.gui.Navpage,avnav.gui.Page);

/**
 * get the mapholder
 * @private
 * @returns {avnav.map.MapHolder}
 */
avnav.gui.Navpage.prototype.getMap=function(){
    if (!this.gui) return null;
    return this.gui.map;
};


avnav.gui.Navpage.prototype.showPage=function(options){
    if (!this.gui) return;
    this.fillDisplayFromGps();
    if (options) this.options_=options;
    else {
        if (! this.options_){
            alert("invalid navpage call - no chart selected");
            return;
        }
    }
    //chartbase: optional url for charts
    //list: the base url
    var chartbase=this.options_.charturl;
    var list=this.options_.url;
    if (! chartbase){
        chartbase=list;
    }
    if (! list.match(/^http:/)){
        if (list.match(/^\//)){
            list=window.location.href.replace(/^([^\/:]*:\/\/[^\/]*).*/,'$1')+list;
        }
        else {
            list=window.location.href.replace(/[?].*/,'').replace(/[^\/]*$/,'')+"/"+list;
        }
    }
    var url=list+"/avnav.xml";
    var self=this;
    $.ajax({
        url:url,
        dataType: 'xml',
        cache: false,
        success: function(data){
            self.getMap().initMap('avi_map_navpage',data,chartbase);
        },
        error: function(ev){
            alert("unable to load charts "+ev.responseText);
        }
    });
};


avnav.gui.Navpage.prototype.hidePage=function(){

};

avnav.gui.Navpage.prototype.fillDisplayFromGps=function(){
    if (! this.navobject) return;
    var gps=this.navobject.getGps();
    var names=gps.getValueNames();
    for (var i=0;i< names.length;i++){
        this.getDiv().find('.avd_'+names[i]).text(gps.getFormattedGpsValue(names[i]));
    }
    if (gps.getGpsData().valid){
        $('#boatPositionStatus').attr('src',this.gui.properties.getProperties().statusOkImage);
    }
    else {
        $('#boatPositionStatus').attr('src',this.gui.properties.getProperties().statusErrorImage);
    }
};

avnav.gui.Navpage.prototype.gpsEvent=function(evdata){
    if (! this.visible) return;
    this.fillDisplayFromGps();
};

//-------------------------- Buttons ----------------------------------------

avnav.gui.Navpage.prototype.btnZoomIn=function (button,ev){
    log("ZoomIn clicked");
    this.getMap().changeZoom(1);
};

avnav.gui.Navpage.prototype.btnZoomOut=function (button,ev){
    log("ZoomOut clicked");
    this.getMap().changeZoom(-1);
};
avnav.gui.Navpage.prototype.btnLockPos=function (button,ev){
    log("LockPos clicked");
};
avnav.gui.Navpage.prototype.btnLockMarker=function (button,ev){
    log("LockMarker clicked");
};
avnav.gui.Navpage.prototype.btnCancelNav=function (button,ev){
    log("CancelNav clicked");
    this.gui.showPage('mainpage');
};

/**
 * create the page instance
 */
(function(){
    //create an instance of the status page handler
    var page=new avnav.gui.Navpage();
}());
