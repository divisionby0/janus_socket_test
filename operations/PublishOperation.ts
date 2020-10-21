///<reference path="../lib/events/EventBus.ts"/>
class PublishOperation {
    private userId:number;
    private plugin:any;
    
    constructor(userId:number, plugin:any) {
        this.userId = userId;
        this.plugin = plugin;
    }
    
    public execute():void{
        this.plugin.createOffer(
            {
                media: {audioRecv: false, videoRecv: false, audioSend: true, videoSend: true},	// Publishers are sendonly
                simulcast: false, // temp. disable simulcast
                simulcast2: false,
                success: (jsep) => {
                    console.log("Got publisher SDP!");
                    console.log(jsep);
                    const publish = {"request": "configure", "audio": true, "video": true};
                    this.plugin.send({"message": publish, "jsep": jsep});
                },
                error: (err) => {
                    console.log("WebRTC ERROR: err=" , err);
                    EventBus.dispatchEvent("WEBRTC_ERROR", err);
                }
            });
    }
}