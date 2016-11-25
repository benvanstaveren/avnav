/**
 * Created by Andreas on 27.04.2014.
 */
var React=require('react');
var OverlayDialog=require('../components/OverlayDialog.jsx');


/**
 *
 * @constructor
 */
var Wpapage=function(){
    avnav.gui.Page.call(this,'wpapage');
    this.statusQuery=0; //sequence handler
    this.indexMap={}; //map an index to ssid
    this.overlay=new avnav.util.Overlay({
        box: '#avi_wpa_box',
        cover: '#avi_wpa_page_inner'
    });
    this.timeout=4000;
    this.numErrors=0;
};
avnav.inherits(Wpapage,avnav.gui.Page);



Wpapage.prototype.showPage=function(options){
    if (!this.gui) return;
    var self=this;
    this.statusQuery=window.setInterval(function(){
        self.doQuery();
    },this.timeout);
    this.indexMap={};
    $('#avi_wpa_interface').html("Query Status");
    $('#avi_wpa_list').html("");
    this.doQuery();
};

Wpapage.prototype.doQuery=function(){
    var self=this;
    var url=this.gui.properties.getProperties().navUrl+"?request=wpa&command=all";
    $.ajax({
        url: url,
        dataType: 'json',
        cache:	false,
        success: function(data,status){
            self.showWpaData(data);
            self.numErrors=0;
        },
        error: function(status,data,error){
            self.numErrors++;
            if (self.numErrors > 3) {
                self.numErrors=0;
                self.toast("Status query Error " + avnav.util.Helper.escapeHtml(error), true)
            }
            avnav.log("wpa query error");
        },
        timeout: this.timeout*0.9
    });

};

Wpapage.prototype.hidePage=function(){
    window.clearInterval(this.statusQuery);
    this.overlay.overlayClose();
};

Wpapage.prototype.formatInterfaceState=function(status){
    var html="<div>Interface: "+status["wpa_state"]+"</div>";
    if (status.wpa_state == "COMPLETED"){
        html+="<div class='avn_wpa_interface_detail'>";
        if (status.ssid){
            html+="&nbsp;["+avnav.util.Helper.escapeHtml(status.ssid)+"]&nbsp;"
        }
        if (status.ip_address){
            html+="IP: "+avnav.util.Helper.escapeHtml(status.ip_address);
        }
        else{
            html+="waiting for IP...";
        }
        html+="</div>"
    }
    return html;
};
Wpapage.prototype.showWpaData=function(data){
    var self=this;
    $('#avi_wpa_interface').html(this.formatInterfaceState(data.status));
    var i;
    var listHtml="<ul>";
    var index=0;
    var lindex=0;
    //find free index
    for (i in this.indexMap){
        if (this.indexMap[i]> index) index=this.indexMap[i];
    }
    index++;
    var seenItems={};
    for (i in data.list){
        var item=data.list[i];
        var ssid=item.ssid;
        if (ssid === undefined) continue;
        lindex=this.indexMap[ssid];
        if (lindex === undefined){
            //add entry
            this.addEntry(item,index);
            this.indexMap[ssid]=index;
            seenItems[index]=1;
            lindex=index;
            index++;
        }
        else{
            var self=this;
            var netid=item['network id'];
            $('#avi_wpa_item'+lindex+' .avn_wpa_item_details_container').html(self.formatItemDetails(item));
            $('#avi_wpa_item'+lindex).attr('data-id',netid ===undefined?-1:netid);
            seenItems[lindex]=1;
        }
        if (data.status.ssid && item.ssid == data.status.ssid){
            $('#avi_wpa_item'+lindex).addClass("avn_wpa_active_item");
        }
        else{
            $('#avi_wpa_item'+lindex).removeClass("avn_wpa_active_item");
        }
    }
    for (i in this.indexMap){
        lindex=this.indexMap[i];
        if (! seenItems[lindex]){
            delete this.indexMap[i];
            $('#avi_wpa_item'+lindex).remove();
        }
    }
};

Wpapage.prototype.addEntry=function(item,index){
    var self=this;
    var ssid=item.ssid;
    var netid=item['network id'];
    if (netid === undefined) netid=-1;
    var ehtml="<li class='avn_wpa_item' id='avi_wpa_item"+index+"' data-id='"+netid+"'><span class='avn_wpa_ssid'>"+avnav.util.Helper.escapeHtml(item.ssid)+"</span>";
    ehtml+="<div class='avn_wpa_item_details_container'>"+this.formatItemDetails(item)+"</div>";
    $('#avi_wpa_list').append(ehtml);
    $('#avi_wpa_item'+index).bind('click',function(){
        self.showWpaDialog(ssid,$(this).attr('data-id'));
    });
};

Wpapage.prototype.formatItemDetails=function(item){
    var ehtml='';
    var level=item['signal level'];
    if (avnav.isString(level)) level=parseInt(level);
    //seems to be strange as some drivers seem to report in %
    if ( level >= 0){
        ehtml+="<span class='avn_wpa_item_detail'>Signal:"+level+"%</span>";
    }
    else{
        ehtml+="<span class='avn_wpa_item_detail'>"+level+"dBm</span>";
    }
    if (item['network id'] !== undefined){
        ehtml+="<span class='avn_wpa_item_detail'>configured</span>";
    }
    if (item['network flags'] !== undefined && item['network flags'].match(/DISABLED/)){
        ehtml+="<span class='avn_wpa_item_detail'>disabled</span>";
    }
    return ehtml;
};

Wpapage.prototype.statusTextToImageUrl=function(text){
    var rt=this.gui.properties.getProperties().statusIcons[text];
    if (! rt) rt=this.gui.properties.getProperties().statusIcons.INACTIVE;
    return rt;
};
Wpapage.prototype.sendRequest=function(request,message,param){
    var self=this;
    self.toast("sending "+message,true);
    var url=this.gui.properties.getProperties().navUrl+"?request=wpa&command="+request;
    $.ajax({
        url: url,
        dataType: 'json',
        cache:	false,
        method: 'POST',
        data: param,
        success: function(data,status){
            avnav.log("request "+request+" OK");
            var statusText=message;
            if (data.status && data.status == "OK") {;}
            else {
                statusText+="...Error";
            }
            self.toast(statusText,true);
        },
        error: function(status,data,error){
            self.toast(message+"...Error",true);
            avnav.log("wpa request error: "+data);
        },
        timeout: this.timeout*2
    });
};

Wpapage.prototype.localInit=function() {
    var self=this;
    this.timeout=this.gui.properties.getProperties().wpaQueryTimeout;
};

Wpapage.prototype.showWpaDialog=function(ssid,id){
    var Dialog=React.createClass({
        propTypes:{
            closeCallback:React.PropTypes.func.isRequired,
            resultCallback: React.PropTypes.func.isRequired

        },
        getInitialState: function(){
            return{
                psk: ''
            }
        },
        valueChange: function(event){
            this.setState({
                psk: event.target.value
            }) ;
        },
        buttonClick: function(event){
            var button=event.target.name;
            this.props.closeCallback();
            if (button != "cancel")  this.props.resultCallback(button,this.state.psk);
        },
        render: function(){
            return (
                    <div className="avi_wpa_dialog">
                        <div>
                            <h3><span >{ssid}</span></h3>
                            <div>
                                <label >Password
                                <input type="password" name="psk" onChange={this.valueChange} value={this.state.psk}/>
                                </label>
                            </div>
                            {id >=0 && <button name="remove" onClick={this.buttonClick}>Remove</button>}
                            <button name="connect" onClick={this.buttonClick}>Connect</button>
                            <button name="cancel" onClick={this.buttonClick}>Cancel</button>
                            {id >= 0 && <button name="enable" onClick={this.buttonClick}>Enable</button>}
                            {id >= 0 && <button name="disable" onClick={this.buttonClick}>Disable</button>}
                            <div className="avn_clear"></div>
                        </div>
                    </div>
            );
        }
    });
    var self=this;
    OverlayDialog.dialog(Dialog,this.getDialogContainer(),{
       resultCallback: function(type,psk){
           var data={
               id: id,
               ssid: ssid
           };
           if (type== 'connect') {
               data.psk=psk;
               self.sendRequest('connect', 'connect to ' + avnav.util.Helper.escapeHtml(data.ssid), data);
               return;
           }
           if (type == 'remove' || type == 'disable'|| type == 'enable'){
               self.sendRequest(type,type+' '+avnav.util.Helper.escapeHtml(data.ssid),data);
               return;
           }
       }
    });
};

//-------------------------- Buttons ----------------------------------------


(function(){
    //create an instance of the status page handler
    var page=new Wpapage();
}());

