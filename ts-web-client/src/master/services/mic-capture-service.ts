import { BehaviorSubject, type Observable } from "rxjs";
import { Logger } from "@utils/logger";

export type MicState = "inactive" | "capturing" | "error";

/**
 * Microphone capture service
 *
 * Manages browser microphone access via getUserMedia and builds
 * a Web Audio API graph for processing. The output MediaStream
 * feeds into WebRTC peer connections for broadcasting.
 *
 * Graph: mic source → inputGain → [effect chain insert] → destination
 */
export class MicCaptureService {
    private logger = new Logger("MicCaptureService");

    private audioContext: AudioContext | null = null;
    private mediaStream: MediaStream | null = null;
    private sourceNode: MediaStreamAudioSourceNode | null = null;
    private inputGainNode: GainNode | null = null;
    private destinationNode: MediaStreamAudioDestinationNode | null = null;
    private analyserNode: AnalyserNode | null = null;
    private monitorGainNode: GainNode | null = null;

    private state$ = new BehaviorSubject<MicState>("inactive");
    private monitoring = false;

    getState$(): Observable<MicState> {
        return this.state$.asObservable();
    }

    getState(): MicState {
        return this.state$.value;
    }

    getAudioContext(): AudioContext | null {
        return this.audioContext;
    }

    getAnalyserNode(): AnalyserNode | null {
        return this.analyserNode;
    }

    /**
     * Returns the processed output stream for WebRTC.
     * This stream carries audio after gain and effects.
     */
    getOutputStream(): MediaStream | null {
        return this.destinationNode?.stream ?? null;
    }

    /**
     * Returns the node where an effect chain should connect its input.
     * The effect chain's output should connect to getEffectChainOutput().
     */
    getEffectChainInput(): AudioNode | null {
        return this.inputGainNode;
    }

    /**
     * Returns the node the effect chain should connect its output to.
     */
    getEffectChainOutput(): AudioNode | null {
        return this.destinationNode;
    }

    async startCapture(deviceId?: string): Promise<void> {
        if (this.state$.value === "capturing") {
            this.logger.warn("Already capturing");
            return;
        }

        try {
            const constraints: MediaStreamConstraints = {
                audio: deviceId ? { deviceId: { exact: deviceId } } : true,
                video: false,
            };

            this.mediaStream =
                await navigator.mediaDevices.getUserMedia(constraints);
            this.audioContext = new AudioContext();

            this.sourceNode = this.audioContext.createMediaStreamSource(
                this.mediaStream,
            );
            this.inputGainNode = this.audioContext.createGain();
            this.destinationNode =
                this.audioContext.createMediaStreamDestination();
            this.analyserNode = this.audioContext.createAnalyser();
            this.analyserNode.fftSize = 256;

            // Monitor gain (muted by default to prevent feedback)
            this.monitorGainNode = this.audioContext.createGain();
            this.monitorGainNode.gain.value = 0;

            // Default graph (no effects): source → gain → destination
            this.sourceNode.connect(this.inputGainNode);
            this.inputGainNode.connect(this.destinationNode);

            // Analyser taps the input for level metering
            this.inputGainNode.connect(this.analyserNode);

            // Monitor path: input → monitor gain → speakers
            this.inputGainNode.connect(this.monitorGainNode);
            this.monitorGainNode.connect(this.audioContext.destination);

            this.state$.next("capturing");
            this.logger.info("Mic capture started", { deviceId });
        } catch (error) {
            this.state$.next("error");
            this.logger.error("Failed to start mic capture", { error });
            throw error;
        }
    }

    stopCapture(): void {
        if (this.mediaStream) {
            for (const track of this.mediaStream.getTracks()) {
                track.stop();
            }
            this.mediaStream = null;
        }

        this.sourceNode?.disconnect();
        this.inputGainNode?.disconnect();
        this.analyserNode?.disconnect();
        this.monitorGainNode?.disconnect();
        this.destinationNode = null;
        this.sourceNode = null;
        this.inputGainNode = null;
        this.analyserNode = null;
        this.monitorGainNode = null;

        if (this.audioContext) {
            this.audioContext.close().catch(() => {});
            this.audioContext = null;
        }

        this.monitoring = false;
        this.state$.next("inactive");
        this.logger.info("Mic capture stopped");
    }

    setInputGain(value: number): void {
        if (this.inputGainNode) {
            this.inputGainNode.gain.value = value;
        }
    }

    setMonitoring(enabled: boolean): void {
        if (!this.monitorGainNode) {
            return;
        }

        this.monitoring = enabled;
        this.monitorGainNode.gain.value = enabled ? 1 : 0;
        this.logger.info("Monitoring", { enabled });
    }

    isMonitoring(): boolean {
        return this.monitoring;
    }

    async getInputDevices(): Promise<MediaDeviceInfo[]> {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.filter((d) => d.kind === "audioinput");
    }
}
