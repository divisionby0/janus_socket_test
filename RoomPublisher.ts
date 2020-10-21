///<reference path="operations/PublishOperation.ts"/>
declare var Janus:any;
class RoomPublisher {
    
    private j$:any;
    private janus:any;
    private pluginPublisherInitData:any;
    private publisherUserId:number;
    private plugin:any;
    
    private myStream:any;
    private streamServerUserId:string;
    private streamServerUserPrivateId:string;
    
    private newRoomData:any;
    private room:number;
    private selfStreamId:string;
    private userId:number;
    private streamId:string;
    private selfVideoElement:any;
    
    constructor(j$:any, janus:any, userId:number, room:number, streamId:string, selfVideoElement:any) {
        console.log("new RoomPublisher");
        this.j$ = j$;
        this.janus = janus;
        this.publisherUserId = userId;
        this.streamId = streamId;
        this.room = room;
        this.selfVideoElement = selfVideoElement;

        console.log("this.publisherUserId=",this.publisherUserId);
        console.log("this.streamId=",this.streamId);
        console.log("this.room=",this.room);
        this.attachPlugin();
    }

    private attachPlugin():void {
        console.log("attachPlugin");
        this.buildPublisherPluginInitData();

        console.log("this.pluginPublisherInitData=",this.pluginPublisherInitData);

        this.janus.attach(this.pluginPublisherInitData);
    }

    private buildPublisherPluginInitData():void {
        this.pluginPublisherInitData = {
            plugin: "janus.plugin.videoroom",
            opaqueId: this.publisherUserId
        };
        this.decoratePublisherPluginDataWithHandlers();
        this.decoratePublisherPluginDataWithWebRTCHandlers();
        this.decoratePublisherPluginDataWithMediaHandlers();
        this.decoratePublisherPluginDataWithMessageHandlers();
    }
    private decoratePublisherPluginDataWithHandlers():void {
        this.pluginPublisherInitData.success = (plugin)=>this.onPublisherPluginAttached(plugin);
        this.pluginPublisherInitData.error = (error)=>this.onPublisherPluginAttachError(error);
        this.pluginPublisherInitData.consentDialog = (on)=>this.onConsentDialog(on);
        this.pluginPublisherInitData.oncleanup = ()=>this.onPublisherGotCleanUpNotification();
    }
    private decoratePublisherPluginDataWithWebRTCHandlers():void {
        this.pluginPublisherInitData.iceState = (state)=>this.onPublisherIceState(state);
        this.pluginPublisherInitData.webrtcState = (on)=>this.onPublisherWebRtcState(on);
    }
    private decoratePublisherPluginDataWithMediaHandlers():void {
        this.pluginPublisherInitData.mediaState = (medium, on)=>this.onPublisherMediaState(medium, on);
        this.pluginPublisherInitData.onlocalstream = (stream)=>this.onLocalStream(stream);
        this.pluginPublisherInitData.onremotestream = (stream)=>this.onPublisherGotRemoteStream(stream);
    }
    private decoratePublisherPluginDataWithMessageHandlers():void {
        this.pluginPublisherInitData.onmessage = (msg, jsep)=>this.onPublisherPluginMessage(msg, jsep);
    }

    private onLocalStream(stream:any):void {
        this.myStream = stream;

        console.info("onLocalStream stream=",stream);
        console.log(" ::: Got a local stream :::", JSON.stringify({id:stream.id, active:stream.active}));
        Janus.debug(" ::: Got a local stream :::", stream);

        this.addInfo(" ::: Got a local stream ::: "+JSON.stringify({id:stream.id, active:stream.active}));

        this.appendSelfCamera();
        this.startSelfCamera();
    }

    private onPublisherPluginMessage(msg:any, jsep:any):void {
        console.log("onPublisherPluginMessage msg=",msg, "jsep=",jsep);

        var event:any = this.parseRoomMessageType(msg);

        if(event) {
            if(event === "joined"){
                this.onJoinedRoom(msg);
            }
        }
        if(jsep) {
            Janus.debug("Handling SDP as well...", jsep);
            console.log("Handling SDP as well...", jsep);

            this.plugin.handleRemoteJsep({ jsep: jsep });

            var audio = msg["audio_codec"];
            var video = msg["video_codec"];
        }
    }
    
    
    private onPublisherPluginAttached(plugin:any):void {
        this.plugin = plugin;
        console.log("plugin attached this.pluginHandler=",this.plugin);

        console.log("creating publisher ...");
        this.createPublisherRoomPluginData();
        this.createNewRoom();
    }
    private createNewRoom():void {
        console.log("creating new room");
        this.plugin.send(this.newRoomData);
    }
    
    private appendSelfCamera():void {
        Janus.attachMediaStream(this.selfVideoElement, this.myStream); // append local media to video tag
        this.selfVideoElement.muted = "muted";
    }
    private startSelfCamera():void {
        this.selfVideoElement.play();
    }

    private createPublisherRoomPluginData():void{
        console.log("creating publisher room data");
        this.newRoomData = {
            "message": {
                "request": "create",
                "room": this.getInt(this.room),
                "permanent": false,
                "secret": "",
                "bitrate": 128000,
                "bitrate_cap": true,
                "fir_freq": 10,
                "notify_joining": false
            },
            success: () => this.onRoomCreated(),
            error: () => this.onRoomCreateError()
        };
    }
    

    private onJoinedRoom(data:any):void {
        this.streamServerUserId = data["id"];
        this.streamServerUserPrivateId = data["private_id"];
        console.log("Successfully joined room " + data["room"] + " with ID " + this.streamServerUserId+"  this.streamServerUserPrivateId="+this.streamServerUserPrivateId);

        this.publishOwnFeed();
    }
    private publishOwnFeed():void {
        console.log("publishOwnFeed");

        var operation:PublishOperation = new PublishOperation(this.userId, this.plugin);
        operation.execute();
    }

    private onRoomCreated():void {
        console.log("onRoomCreated !");
        this.joinRoomByPublisher();
    }
    private joinRoomByPublisher():void{
        console.log("joining room by publisher");
        var register = {
            message:{
                request: "join",
                room: +this.room,
                ptype: "publisher",
                display: this.selfStreamId
            }
        };

        console.log("register=",register);
        this.plugin.send(register);
    }
    
    
    private onPublisherGotRemoteStream(stream:any):void{
        // do nothing
    }
    
    private onPublisherMediaState(medium:any, on:any):void {
        console.log("onPublisherMediaState medium=",medium, "on=",on);
    }
    
    private onPublisherWebRtcState(on:any):void {
        console.log("onPublisherWebRtcState on=",on);
        console.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
        this.addInfo("our WebRTC PeerConnection is " + on);
    }
    
    // ICE
    private onPublisherIceState(state:any):void {
        console.log("onPublisherIceState state=",state);
    }
    

    private onPublisherGotCleanUpNotification():void {
        console.log("onPublisherGotCleanUpNotification");
    }
    private onConsentDialog(on:any):void{
        console.log("onConsentDialog on=",on);
    }
    
    private onPublisherPluginAttachError(error:any):void {
        console.error("plugin attach error",error);
        this.addInfo("plugin attach error="+JSON.stringify(error));
    }


    // TODO common functions must be in parent class
    private addInfo(s:string):void {
        var info:string = this.j$("#infoContainer").text();
        info+="`"+JSON.stringify(s)+"`||";
        this.j$("#infoContainer").text(info);
    }
    private parseRoomMessageType(msg:any):any{
        return msg["videoroom"];
    }
    private getInt(value:any):number{
        return +value;
    }
    private onRoomCreateError():void {
        this.addInfo("Failed to create a room.");
    }
}