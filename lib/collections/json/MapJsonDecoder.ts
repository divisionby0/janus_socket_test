///<reference path="../KeyMap.ts"/>
class MapJsonDecoder{
    private rootMap:KeyMap<any>;
    private dataString:string;


    constructor(dataString:string) {
        this.rootMap = new KeyMap<any>('rootMap');
        this.dataString = dataString;
    }

    public decode():KeyMap<any>{
        this.parseStringToMap(this.dataString, this.rootMap);
        return this.rootMap;
    }


    private parseStringToMap(dataString:string, parentMap:KeyMap<any>):void{
        var dataJson:any = JSON.parse(dataString);
        this.parseObjectToMap(dataJson, parentMap);
    }

    private parseObjectToMap(dataObject:any, parentMap:KeyMap<any>):KeyMap<any>{

        var id:string = dataObject["id"];
        var type:string = dataObject["type"];


        if(type=="Map"){

            for(var key in dataObject){
                var value:any = dataObject[key];
                var valueId:string = value["id"];
                var valueType:string = value["type"];

                if(key!="id" && key!="type" && valueType=="Map"){
                    var subMap:KeyMap<any> = new KeyMap<any>(valueId);
                    parentMap.add(key, this.parseObjectToMap(value, subMap));
                }
                else{
                    if(key === "id"){
                        parentMap.setId(value);
                    }
                    else if(key != "type"){
                        parentMap.add(key, value);
                    }
                }
            }
        }
        return parentMap;

    }
}
