import React from 'react';
import Button from './Button.jsx';
import Dynamic from '../hoc/Dynamic.jsx';
import LayoutEditing from '../hoc/LayoutEditMode.jsx';
import Visible from '../hoc/Visible.jsx';
import keys from '../util/keys.jsx';
import ItemList from './ItemList.jsx';
import PropertyHandler from '../util/propertyhandler.js';

const DynamicList=Dynamic(ItemList);
module.exports=function(props){
    let className=props.className||"";
    className+=" buttonContainer";
    return <DynamicList {...props}
        className={className}
        itemClass={Dynamic(Visible(LayoutEditing(Button)))}
        storeKeys={{
            fontSize:keys.gui.global.buttonFontSize,
            dimensions: keys.gui.global.windowDimensions
            }}
        updateFunction={(state)=>{
            return {
            fontSize: PropertyHandler.getButtonFontSize()
            };
        }}
        />
};