///<reference path="lib/events/EventBus.ts"/>
declare var Janus:any;
class RoomSubscriber {
    private j$:any;
    private janus:any;
    private plugin:any;
    private room:number;
    private subscriberUserId:number;
    private remoteStreamId:string;
    
    private pluginSubscriberInitData:any;
    private publisherServerInternalUserId:number;
    private subscriptionData:any;
    private remoteStream:any;
    private remoteVideoElement:any;
    
    constructor(j$:any, janus:any, userId:number, room:number, remoteStreamId:string, remoteVideoElement:any) {
        this.j$ = j$;

        console.log("new RoomSubscriber");
        this.j$ = j$;
        this.janus = janus;
        this.subscriberUserId = userId;
        this.room = room;
        this.remoteStreamId = remoteStreamId;
        this.remoteVideoElement = remoteVideoElement;
        this.attachPlugin();
    }

    private attachPlugin():void {
        console.log("attachSubscriberPlugin");
        this.buildSubscriberPluginInitData();

        this.janus.attach(this.pluginSubscriberInitData);
    }

    private joinRoomBySubscriber():void{
        console.log("joinRoomBySubscriber");

        this.createSubscriberRoomPluginData();

        console.log("this.subscriptionData=",this.subscriptionData);

        this.plugin.send(this.subscriptionData);
    }

    private createSubscriberRoomPluginData():void{
        console.log("creating subscriber room data this.room="+this.room+" this.publisherServerInternalUserId(feed)="+this.publisherServerInternalUserId+" this.subscriberUserId="+this.subscriberUserId);

        this.subscriptionData = {
            message:{
                "request": "join",
                "room": this.getInt(this.room),
                "ptype": "subscriber",
                "feed": this.publisherServerInternalUserId,
                "private_id": this.getInt(this.subscriberUserId)
            }
        };
    }

    private buildSubscriberPluginInitData():void{
        console.log("buildSubscriberPluginInitData");
        this.pluginSubscriberInitData = {
            plugin: "janus.plugin.videoroom",
            opaqueId: this.subscriberUserId
        };
        this.decorateSubscriberPluginDataWithHandlers();
        this.decorateSubscriberPluginDataWithWebRTCHandlers();
        this.decorateSubscriberPluginDataWithMediaHandlers();
        this.decorateSubscriberPluginDataWithMessageHandlers();
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

    private onSubscriberPluginAttached(plugin:any):void{
        this.plugin = plugin;
        this.plugin.simulcastStarted = false;

        this.addInfo("Plugin attached! (" + this.plugin.getPlugin() + ", id=" + this.plugin.getId() + ")");
        console.log("plugin attached this.pluginHandler=",this.plugin);

        EventBus.addEventListener("ON_PUBLISHER_SELECTED", (id)=>this.onPublisherParticipantSelected(id));

        this.selectPublisherParticipant();
    }
    private onSubscriberPluginAttachError(error:any):void {
        console.error("plugin attach error",error);
        this.addInfo("plugin attach error="+JSON.stringify(error));
    }
    private onSubscriberGotCleanUpNotification():void{
        Janus.log(" ::: Subscriber got a cleanup notification from remote feed " + this.publisherServerInternalUserId + ") :::");
    }

    private onSubscriberWebRtcState(on:any, reason:any):void {
        console.log("onSubscriberWebRtcState on=",on, "reason=",reason);

        console.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
        this.addInfo("our WebRTC PeerConnection is " + on);
        this.addInfo("reason: ");
        this.addInfo(reason);

        if(on == true){
            this.unmuteRemoteVideo();
        }

        var publisherClosed:boolean = reason === "Close PC";

        if(publisherClosed){
            this.onPublisherClosedHisBroadcasting();
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
    private startSubscription(_jsep:any) {
        console.log("startSubscription remoteStreamId=",this.remoteStreamId," jsep=",_jsep);
        const body:any = {"request": "start", "room": this.remoteStreamId};
        this.plugin.send({"message": body, "jsep": _jsep});
    }
    

    private onSubscriberMediaState(medium:any, on:any):void {
        console.log("onSubscriberMediaState medium=",medium, "on=",on);
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

        this.remoteStream = stream;
        
        this.attachRemoteStream();
        this.startRemoteVideo();
    }

    private attachRemoteStream():void {
        Janus.attachMediaStream(this.remoteVideoElement, this.remoteStream );
        this.remoteVideoElement.muted = "muted";
    }
    private startRemoteVideo():void {
        console.log("trying to start remote video ...");
        this.remoteVideoElement.play();
    }
    private unmuteRemoteVideo():void{
        console.log("unmuting remote video");
        this.remoteVideoElement.mute = false;
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

    private onSubscriberCreateSDPAnswerError(error:any):void{
        console.error("WebRTC error:", error);
        this.addInfo("WebRTC error");
        this.addInfo(error);
    }

    private onSubscriberSlowLink():void {
        console.error("!! on slow link info event");
        this.addInfo("on subscriber slow link");
    }

    // ICE
    private onSubscriberIceState(state:any):void {
        console.log("onSubscriberIceState state=",state);
    }
    
    // TODO common functions must be in parent class
    private addInfo(s:string):void {
        var info:string = this.j$("#infoContainer").text();
        info+="`"+JSON.stringify(s)+"`||";
        this.j$("#infoContainer").text(info);
    }
    private getInt(value:any):number{
        return +value;
    }
}