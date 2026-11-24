export class BeachSound {
  private context?: AudioContext;
  private master?: GainNode;
  private started=false;
  async setEnabled(enabled:boolean) {
    if (!enabled && !this.context) return;
    const context=this.context??=new AudioContext();
    if (!enabled) {
      await context.suspend();
      return;
    }
    await context.resume();
    if (this.started) return;
    this.started=true;
    this.master=context.createGain();
    this.master.gain.value=.5;
    this.master.connect(context.destination);
    this.noiseLayer(760,.19,.21,.80,'lowpass');
    this.noiseLayer(1650,.031,.36,.65,'bandpass');
    this.noiseLayer(370,.035,.79,.54,'bandpass',2.1);
    this.noiseLayer(920,.014,1.27,.69,'bandpass',3);
  }
  private noiseLayer(frequency:number,volume:number,rate:number,depth:number,type:BiquadFilterType,q=.65){
    const context=this.context!;
    const noise=context.createBuffer(1,context.sampleRate*6,context.sampleRate);
    const data=noise.getChannelData(0);
    let last=0;
    for(let i=0;i<data.length;i++){
      last=.75*last+.25*(Math.random()*2-1);
      data[i]=last;
    }
    const source=context.createBufferSource();source.buffer=noise;source.loop=true;
    const filter=context.createBiquadFilter();filter.type=type;filter.frequency.value=frequency;filter.Q.value=q;
    const gain=context.createGain();gain.gain.value=volume;
    const swell=context.createOscillator();swell.frequency.value=rate;
    const modulation=context.createGain();modulation.gain.value=volume*depth;
    swell.connect(modulation).connect(gain.gain);
    source.connect(filter).connect(gain).connect(this.master!);
    source.start();swell.start();
  }
}