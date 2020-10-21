///<reference path="../KeyMap.ts"/>
class MapJsonEncoder{
    private collection:KeyMap<any>;

    constructor(collection:KeyMap<any>) {
        this.collection = collection;
    }
    public encode():string{
        var parsedObject:any = this.parseToObject(this.collection);
        var parsedJson:string = JSON.stringify(parsedObject);
        return parsedJson;
    }

    private parseToObject(collection:KeyMap<any>):any{
        var parsedObject:any = {};
        parsedObject['id']=collection.getId();
        parsedObject['type']="Map";

        var keys:string[] = collection.getKeys();

        for(var index in keys){
            var currentKey:string = keys[index];
            var currentValue:any = collection.get(currentKey);
            var isMap:boolean = currentValue instanceof KeyMap;

            if(isMap){
                parsedObject[currentKey] = this.parseToObject(currentValue);
            }
            else{
                parsedObject[currentKey] = currentValue;
            }
        }

        return parsedObject;
    }
}
