import { BehaviorSubject, type Observable } from "rxjs";
import { Logger } from "@utils/logger";
import type {
    WebRTCSignalingService,
    SignalingMessage,
} from "@services/webrtc-signaling-service";

const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

/**
 * WebRTC receiver service (display client only)
 *
 * Receives audio streams from the master client via WebRTC.
 * Handles SDP negotiation and ICE candidate exchange, then
 * exposes the received MediaStream for playback.
 */
export class WebRTCReceiverService {
    private logger = new Logger("WebRTCReceiverService");
    private peerConnection: RTCPeerConnection | null = null;
    private masterClientId: string | null = null;
    private channel: string | null = null;
    private stream$ = new BehaviorSubject<MediaStream | null>(null);

    constructor(private signalingService: WebRTCSignalingService) {
        this.signalingService.onOffer((msg) => this.handleOffer(msg));
        this.signalingService.onCandidate((msg) => this.handleCandidate(msg));
    }

    getStream$(): Observable<MediaStream | null> {
        return this.stream$.asObservable();
    }

    getStream(): MediaStream | null {
        return this.stream$.value;
    }

    /**
     * Handle an incoming SDP offer from the master.
     */
    private async handleOffer(msg: SignalingMessage): Promise<void> {
        this.close();

        this.masterClientId = msg.metadata.source;
        this.channel = msg.payload.channel;

        this.logger.info("Received offer", {
            masterClientId: this.masterClientId,
            channel: this.channel,
        });

        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        this.peerConnection = pc;

        pc.ontrack = (event) => {
            const remoteStream = event.streams[0];
            if (remoteStream) {
                this.stream$.next(remoteStream);
                this.logger.info("Remote stream received");
            }
        };

        pc.onicecandidate = (event) => {
            if (event.candidate && this.masterClientId) {
                this.signalingService.sendCandidate(
                    this.masterClientId,
                    this.channel ?? "",
                    JSON.stringify(event.candidate),
                );
            }
        };

        pc.onconnectionstatechange = () => {
            this.logger.info("Connection state", { state: pc.connectionState });

            if (
                pc.connectionState === "failed" ||
                pc.connectionState === "disconnected"
            ) {
                this.close();
            }
        };

        const desc = JSON.parse(
            msg.payload.sdp ?? "",
        ) as RTCSessionDescriptionInit;
        await pc.setRemoteDescription(new RTCSessionDescription(desc));

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        this.signalingService.sendAnswer(
            this.masterClientId,
            this.channel ?? "",
            JSON.stringify(pc.localDescription),
        );

        this.logger.info("Answer sent");
    }

    /**
     * Handle a remote ICE candidate from the master.
     */
    private async handleCandidate(msg: SignalingMessage): Promise<void> {
        if (!this.peerConnection) {
            return;
        }

        if (msg.metadata.source !== this.masterClientId) {
            return;
        }

        const candidate = JSON.parse(
            msg.payload.candidate ?? "",
        ) as RTCIceCandidateInit;
        await this.peerConnection.addIceCandidate(
            new RTCIceCandidate(candidate),
        );
    }

    close(): void {
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        this.stream$.next(null);
        this.masterClientId = null;
        this.channel = null;
    }
}
