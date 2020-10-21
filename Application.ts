///<reference path="operations/PublishOperation.ts"/>
///<reference path="lib/events/EventBus.ts"/>
declare var Janus:any;
declare var adapter:any;
class Application {
    private j$:any;
    private mediaServerUrl:any;

    private janus:any;
    private plugin:any;
    private pluginPublisherInitData:any;
    private pluginSubscriberInitData:any;

    private publisherUserId:string = "publisher_777";
    private subscriberUserId:string = "subscriber_777";

    private newRoomData:any;
    private existingRoomData:any;
    private role:string;
    private room:number;
    //private streamId:string;
    private selfStreamId:string;
    private remoteStreamId:string;

    private userId:number;

    private publisherServerInternalUserId:number;
    
    private streamServerUserId:string;
    private streamServerUserPrivateId:string;

    private isPublisher:boolean = undefined;

    private myStream:any;

    // TODO обработчики разбросать по сущностям
    constructor(j$:any, mediaServerUrl:any, role:string, room:number, streamId:string, userId:number) {
        this.j$ = j$;
        this.mediaServerUrl = mediaServerUrl;
        this.role = role;
        this.room = room;

        if(this.role === "publish"){
            this.selfStreamId = streamId;
            console.log("App mediaserver=",this.mediaServerUrl, "role=",this.role, "room=",this.room, "self streamId=",this.selfStreamId, "userId=",this.userId);
        }
        else{
            this.remoteStreamId = streamId;
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

    private joinRoomByPublisher():void{
        console.log("joining room by publisher");
        var register = {
            request: "join",
            room: +this.room,
            ptype: "publisher",
            display: this.selfStreamId
        };

        console.log("register=",register);
        this.plugin.send({ message: register });
    }

    private joinRoomBySubscriber():void{
        console.log("joinRoomBySubscriber");

        this.createSubscriberRoomPluginData();

        console.log("this.existingRoomData=",this.existingRoomData);

        this.plugin.send(this.existingRoomData);
    }

    private onSessionCreateComplete():void {
        console.log("onSessionCreateComplete janus = ",this.janus);
        if(this.role == "publish"){
            this.attachPublisherPlugin();
        }
        else{
            console.log("need to attach subscriber plugin");
            this.attachSubscriberPlugin();
        }
    }

    private attachPublisherPlugin():void {
        this.buildPublisherPluginInitData();
        this.janus.attach(this.pluginPublisherInitData);
    }

    private attachSubscriberPlugin():void {
        console.log("attachSubscriberPlugin");
        this.buildSubscriberPluginInitData();

        this.janus.attach(this.pluginSubscriberInitData);
    }

    private onSubscriberPluginAttached(plugin:any):void{
        this.plugin = plugin;
        this.plugin.simulcastStarted = false;

        this.addInfo("Plugin attached! (" + this.plugin.getPlugin() + ", id=" + this.plugin.getId() + ")");
        console.log("plugin attached this.pluginHandler=",this.plugin);

        EventBus.addEventListener("ON_PUBLISHER_SELECTED", (id)=>this.onPublisherParticipantSelected(id));

        this.selectPublisherParticipant();
    }

    private onPublisherPluginAttached(plugin:any):void {
        this.plugin = plugin;
        console.log("plugin attached this.pluginHandler=",this.plugin);

        console.log("creating publisher ...");
        this.createPublisherRoomPluginData();
        this.createNewRoom();
    }

    private onConsentDialog(on:any):void{
        console.log("onConsentDialog on=",on);
    }

    private buildSubscriberPluginInitData():void{
        console.log("buildSubscriberPluginInitData");
        this.pluginSubscriberInitData = {
            plugin: "janus.plugin.videoroom",
            opaqueId: this.subscriberUserId
        };
        this.decorateSubscriberPluginDataWithHandlers();
        /*
        this.decorateSubscriberPluginDataWithWebRTCHandlers();
        this.decorateSubscriberPluginDataWithMediaHandlers();
        this.decorateSubscriberPluginDataWithMessageHandlers();
        */
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


    private decorateSubscriberPluginDataWithHandlers():void{
        this.pluginSubscriberInitData.success = (plugin)=>this.onSubscriberPluginAttached(plugin);
        this.pluginSubscriberInitData.error = (error)=>this.onSubscriberPluginAttachError(error);
        this.pluginSubscriberInitData.oncleanup = ()=>this.onSubscriberGotCleanUpNotification();
    }
    private decorateSubscriberPluginDataWithMessageHandlers():void {
        this.pluginSubscriberInitData.onmessage = (msg, jsep)=>this.onSubscriberPluginMessage(msg, jsep);
    }
    private decorateSubscriberPluginDataWithWebRTCHandlers():void{
        this.pluginSubscriberInitData.iceState = (state)=>this.onSubscriberIceState(state);
        this.pluginSubscriberInitData.webrtcState = (on, reason)=>this.onSubscriberWebRtcState(on, reason);
    }
    private decorateSubscriberPluginDataWithMediaHandlers():void{
        this.pluginSubscriberInitData.mediaState = (medium, on)=>this.onSubscriberMediaState(medium, on);
        this.pluginSubscriberInitData.onremotestream = (stream)=>this.onSubscriberGotRemoteStream(stream);
    }

    // ICE
    private onPublisherIceState(state:any):void {
        console.log("onPublisherIceState state=",state);
    }
    private onSubscriberIceState(state:any):void {
        console.log("onSubscriberIceState state=",state);
    }

    private onPublisherWebRtcState(on:any):void {
        console.log("onPublisherWebRtcState on=",on);
        console.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
        this.addInfo("our WebRTC PeerConnection is " + on);
    }

    private onSubscriberWebRtcState(on:any, reason:any):void {
        console.log("onSubscriberWebRtcState on=",on, "reason=",reason);

        console.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
        this.addInfo("our WebRTC PeerConnection is " + on);
        this.addInfo("reason: ");
        this.addInfo(reason);

        var publisherClosed:boolean = reason === "Close PC";

        if(publisherClosed){
            this.onPublisherClosedHisBroadcasting();
        }
    }

    private onPublisherMediaState(medium:any, on:any):void {
        console.log("onPublisherMediaState medium=",medium, "on=",on);
    }

    private onSubscriberMediaState(medium:any, on:any):void {
        console.log("onSubscriberMediaState medium=",medium, "on=",on);
    }

    private onLocalStream(stream:any):void {
        this.myStream = stream;

        console.info("onLocalStream stream=",stream);
        console.log(" ::: Got a local stream :::", JSON.stringify({id:stream.id, active:stream.active}));
        Janus.debug(" ::: Got a local stream :::", stream);

        this.addInfo(" ::: Got a local stream ::: "+JSON.stringify({id:stream.id, active:stream.active}));

        var selfVideoHtmlElement:any = this.j$('#selfVideo').get(0);

        this.appendSelfCamera(selfVideoHtmlElement);
        this.startSelfCamera(selfVideoHtmlElement);
    }

    private onPublisherGotRemoteStream(stream:any):void{
        // do nothing
    }

    private onSubscriberGotRemoteStream(stream:any):void{
        console.log("onremotestream: Remote feed #" + this.remoteStreamId);
        const videoTracks = stream.getVideoTracks();
        const audioTracks = stream.getAudioTracks();

        const hasVideo = videoTracks && videoTracks.length !== 0;
        const hasAudio = audioTracks && audioTracks.length !== 0;

        const notMutedVidTracks = hasVideo && videoTracks.find(track => !track.muted);
        const notMutedAudTracks = hasAudio && videoTracks.find(track => !track.muted);

        console.log(`videoTracks ${videoTracks.length}; notMutedVidTracks ${notMutedVidTracks}; audioTracks ${audioTracks.length}; notMutedAudTracks ${notMutedAudTracks}`);

        Janus.attachMediaStream(this.j$('#remoteVideo').get(0), stream);
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

    private onSubscriberPluginMessage(msg:any, jsep:any):void{
        console.log(" ::: Got a message (subscriber) :::", msg);
        this.addInfo("onSubscriberPluginMessage");
        this.addInfo(msg);

        const event = msg["videoroom"];
        console.log("Event: ", event);

        if (msg["error"])
        {
            if (msg["error"] !== "No such room") {
                this.addInfo("Join room error");
                this.addInfo(msg["error"]);
            }
        }
        else if (event)
        {
            if (event === "attached") {
                // Subscriber created and attached
                this.addInfo("Subscriber plugin created and attached");

                this.plugin.rfid = msg["id"];
                this.plugin.rfdisplay = msg["display"];

                console.log("Successfully attached to feed " + this.plugin.rfid + " (" + this.plugin.rfdisplay + ") in room " + msg["room"]);
                this.addInfo("Successfully attached to feed " + this.plugin.rfid + " (" + this.plugin.rfdisplay + ") in room " + msg["room"]);
            }
            else if (event === "slow_link") {
                this.onSubscriberSlowLink();
            }
        }

        if (jsep) {
            console.log("Handling subscriber SDP as well...", jsep);
            this.createSubscriberSDPAnswer(jsep);
        }
    }

    private onPublisherPluginAttachError(error:any):void {
        console.error("plugin attach error",error);
        this.addInfo("plugin attach error="+JSON.stringify(error));
    }
    private onSubscriberPluginAttachError(error:any):void {
        console.error("plugin attach error",error);
        this.addInfo("plugin attach error="+JSON.stringify(error));
    }

    private onSessionCreateError(error:any):void {
        console.log("onSessionCreateError error=",error);
        this.addInfo("onSessionCreateError error="+JSON.stringify(error));
    }

    private onSessionDestroyed():void {
        console.log("onSessionDestroyed");
    }
    private onPublisherGotCleanUpNotification():void {
        console.log("onPublisherGotCleanUpNotification");
    }
    private onSubscriberGotCleanUpNotification():void{
        Janus.log(" ::: Subscriber got a cleanup notification from remote feed " + this.publisherServerInternalUserId + ") :::");
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

    private createSubscriberRoomPluginData():void{
        console.log("creating subscriber room data this.room="+this.room+" this.publisherServerInternalUserId(feed)="+this.publisherServerInternalUserId+" this.subscriberUserId="+this.subscriberUserId);

        /*
        this.existingRoomData = {
            "request": "join",
            "room": this.getInt(this.room),
            "ptype": "subscriber",
            "feed": this.remoteStreamId,
            "private_id": this.subscriberUserId
        };
        */

        this.existingRoomData = {
            "request": "join",
            "room": this.getInt(this.room),
            "ptype": "subscriber",
            "feed": this.publisherServerInternalUserId,
            "private_id": this.subscriberUserId
        };
    }

    private createNewRoom():void {
        console.log("creating new room");
        this.plugin.send(this.newRoomData);
    }

    private onRoomCreated():void {
        console.log("onRoomCreated !");
        if(this.role == "publish"){
            this.joinRoomByPublisher();
        }
    }

    private onRoomCreateError():void {
        this.addInfo("Failed to create a room.");
    }

    private getInt(value:any):number{
        return +value;
    }

    private parseRoomMessageType(msg:any):any{
        return msg["videoroom"];
    }

    private onJoinedRoom(data:any):void {
        this.streamServerUserId = data["id"];
        this.streamServerUserPrivateId = data["private_id"];
        console.log("Successfully joined room " + data["room"] + " with ID " + this.streamServerUserId+"  this.streamServerUserPrivateId="+this.streamServerUserPrivateId);

        if(this.isPublisher){
            this.publishOwnFeed();
        }
        else{

        }
    }

    private publishOwnFeed():void {
        console.log("publishOwnFeed");
        
        var operation:PublishOperation = new PublishOperation(this.userId, this.plugin);
        operation.execute();
    }

    private onWebRtcError(error:any):void {
        this.j$("#errorContainer").text(JSON.stringify(error));
    }

    private addInfo(s:string):void {
        var info:string = this.j$("#infoContainer").text();
        info+="`"+JSON.stringify(s)+"`||";
        this.j$("#infoContainer").text(info);
    }

    private appendSelfCamera(selfVideoHtmlElement:any):void {
        Janus.attachMediaStream(selfVideoHtmlElement, this.myStream); // append local media to video tag
        selfVideoHtmlElement.muted = "muted";
    }

    private startSelfCamera(selfVideoHtmlElement:any):void {
        selfVideoHtmlElement.play();
    }


    private selectPublisherParticipant():void {
        console.log("selectPublisherParticipant in room "+this.room);
        this.plugin.send({
            "message": {
                "request": "listparticipants",
                "room": this.getInt(this.room)
            },
            success: (res)=>this.onRoomParticipantsLoaded(res)
        });
    }


    private onRoomParticipantsLoaded(res:any):void {
        console.log("onRoomParticipantsLoaded  res=",res);


        var hasPublisher:boolean = res.participants && res.participants.length > 0;

        console.log("hasPublisher = "+hasPublisher);

        if(hasPublisher){
            console.log("Subscriber can join room");
            var publisherParticipant:any = res.participants[0];
            var publisherId:string = publisherParticipant.id;

            console.log("publisherParticipant=",publisherParticipant);

            EventBus.dispatchEvent("ON_PUBLISHER_SELECTED", publisherId);
        }
        else{
            this.addInfo("No participants in room. Exit application !");
            if (this.plugin)
            {
                this.plugin.ondetached();
                this.plugin.detach();
                this.plugin = null;
            }

            if(this.janus){
                this.janus.destroy();
                this.janus = null;
            }
            return;
        }
    }


    private onPublisherParticipantSelected(id:any):void {
        EventBus.removeEventListener("ON_PUBLISHER_SELECTED", (id)=>this.onPublisherParticipantSelected(id));
        console.log("onPublisherParticipantSelected  id=",id);
        this.publisherServerInternalUserId = id;

        console.log("this.publisherServerInternalUserId="+this.publisherServerInternalUserId);

        this.joinRoomBySubscriber();
    }

    private onPublisherClosedHisBroadcasting():void {
        this.addInfo("Publisher closed his broadcasting");
    }

    private onSubscriberSlowLink():void {
        console.error("!! on slow link info event");
        this.addInfo("on subscriber slow link");
    }

    private createSubscriberSDPAnswer(jsep:any):void {
        // Answer and attach
        this.plugin.createAnswer(
            {
                jsep: jsep,
                media: {audioSend: false, videoSend: false},	// We want recvonly audio/video
                success:(_jsep)=>this.onSubscriberCreateSDPAnswerComplete(_jsep),
                error:(error)=>this.onSubscriberCreateSDPAnswerError(error)
            }
        );
    }
    
    private onSubscriberCreateSDPAnswerComplete(jsep:any):void{
        console.log("onSubscriberCreateSDPAnswerComplete jsep", jsep);
        this.startSubscription(jsep);
    }
    private onSubscriberCreateSDPAnswerError(error:any):void{
        console.error("WebRTC error:", error);
        this.addInfo("WebRTC error");
        this.addInfo(error);
    }

    private startSubscription(_jsep:any) {
        console.log("startSubscription remoteStreamId=",this.remoteStreamId," jsep=",_jsep);
        const body:any = {"request": "start", "room": this.remoteStreamId};
        this.plugin.send({"message": body, "jsep": _jsep});
    }
}