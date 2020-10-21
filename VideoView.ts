class VideoView {
    private j$:any;

    private element:any;

    private muted:boolean = true;

    constructor(j$:any, tag:string) {
        this.j$ = j$;

        this.element = this.j$(tag).get(0);

        console.log("element=",this.element);
        
        if(this.element!=null && this.element!=undefined){
            this.createClickListener();
        }
    }
    
    public getElement():any{
        return this.element;
    }
    
    private onElementClicked(event:any):void{
        console.log("element clicked event=",event);
        //this.removeClickListener();

        this.muted = !this.muted;

        this.j$(this.element).mute = this.muted;
        this.j$(this.element).volume = 1;
    }

    private createClickListener():void {
        this.j$(this.element).on("click", (event)=>this.onElementClicked(event));
    }
    private removeClickListener():void {
        this.j$(this.element).off("click");
    }
}