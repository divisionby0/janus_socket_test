///<reference path="operations/PublishOperation.ts"/>
///<reference path="lib/events/EventBus.ts"/>
///<reference path="RoomPublisher.ts"/>
///<reference path="RoomSubscriber.ts"/>
///<reference path="VideoView.ts"/>
declare var Janus:any;
declare var adapter:any;
class Application {
    private j$:any;
    private mediaServerUrl:any;

    private janus:any;

    private role:string;
    private room:number;
    private selfStreamId:string;
    private remoteStreamId:string;

    private userId:number;
    private ver:string = "0.0.2";

    private isPublisher:boolean = undefined;

    private selfVideoElement:any;
    private remoteVideoElement:any;

    // TODO обработчики разбросать по сущностям
    constructor(j$:any, mediaServerUrl:any, role:string, room:number, streamId:string, userId:number) {
        console.log(this.ver);
        this.j$ = j$;
        this.mediaServerUrl = mediaServerUrl;
        this.role = role;
        this.room = room;

        if(this.role === "publish"){
            this.selfStreamId = streamId;
            this.createSelfVideoElement();
            console.log("App mediaserver=",this.mediaServerUrl, "role=",this.role, "room=",this.room, "self streamId=",this.selfStreamId, "userId=",this.userId);
        }
        else{
            this.remoteStreamId = streamId;
            this.createRemoteVideoElement();
            console.log("App mediaserver=",this.mediaServerUrl, "role=",this.role, "room=",this.room, "self remoteStreamId=",this.remoteStreamId, "userId=",this.userId);
        }

        this.userId = userId;

        if(this.role == "publish"){
            this.isPublisher = true;
        }
        else if(this.role == "subscribe"){
            this.isPublisher = false;
        }

        EventBus.addEventListener("WEBRTC_ERROR", (error)=>this.onWebRtcError(error));

        console.log(JSON.stringify(adapter.browserDetails));
        this.addInfo("BROWSER:"+JSON.stringify(adapter.browserDetails));

        this.initJanusLib();
    }

    private initJanusLib():void {
        Janus.init({
            debug: "all",
            callback: ()=>this.janusLibInitHandler()
        });
    }

    private janusLibInitHandler():void {
        console.log("janusLibInitHandler");

        if(!Janus.isWebrtcSupported()) {
            EventBus.dispatchEvent("WEBRTC_ERROR", "Janus says No WebRTC support...");
        }

        this.janus = new Janus({
            server: this.mediaServerUrl,
            success:()=>this.onSessionCreateComplete(),
            error: (error)=>this.onSessionCreateError(error),
            destroyed: ()=>this.onSessionDestroyed()
        });
    }

    private onSessionCreateComplete():void {
        console.log("onSessionCreateComplete janus = ",this.janus);

        if(this.role == "publish"){
            this.createPublisher();
        }
        else{
            this.createSubscriber();
        }
    }
    private onSessionCreateError(error:any):void {
        console.log("onSessionCreateError error=",error);
        this.addInfo("onSessionCreateError error="+JSON.stringify(error));
    }

    private createPublisher():void {
        console.log("creating publisher ... this.userId=",this.userId, "this.selfStreamId=",this.selfStreamId);
        new RoomPublisher(this.j$, this.janus, this.userId, this.room, this.selfStreamId, this.selfVideoElement);
    }
    private createSubscriber():void {
        console.log("creating subscriber ... this.userId=",this.userId, "this.remoteStreamId=",this.remoteStreamId);
        new RoomSubscriber(this.j$, this.janus, this.userId, this.room, this.remoteStreamId, this.remoteVideoElement);
    }

    private onSessionDestroyed():void {
        console.log("onSessionDestroyed");
    }

    private createSelfVideoElement():void{
        var selfVideoView:VideoView = new VideoView(this.j$, "#selfVideo");
        this.selfVideoElement = selfVideoView.getElement();
    }
    private createRemoteVideoElement():void{
        var remoteVideoView:VideoView = new VideoView(this.j$, "#remoteVideo");
        this.remoteVideoElement = remoteVideoView.getElement();
    }


    private getInt(value:any):number{
        return +value;
    }

    private parseRoomMessageType(msg:any):any{
        return msg["videoroom"];
    }

    private onWebRtcError(error:any):void {
        this.j$("#errorContainer").text(JSON.stringify(error));
    }

    private addInfo(s:string):void {
        var info:string = this.j$("#infoContainer").text();
        info+="`"+JSON.stringify(s)+"`||";
        this.j$("#infoContainer").text(info);
    }
}