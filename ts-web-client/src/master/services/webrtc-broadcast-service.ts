import { Logger } from "@utils/logger";
import type {
    WebRTCSignalingService,
    SignalingMessage,
} from "@services/webrtc-signaling-service";

const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

/**
 * WebRTC broadcast service (master only)
 *
 * Manages one RTCPeerConnection per display client to broadcast
 * the master's processed audio stream. Handles SDP negotiation
 * and ICE candidate exchange via the signaling service.
 */
export class WebRTCBroadcastService {
    private logger = new Logger("WebRTCBroadcastService");
    private peerConnections = new Map<string, RTCPeerConnection>();
    private activeStream: MediaStream | null = null;
    private activeChannel = "";

    constructor(private signalingService: WebRTCSignalingService) {
        this.signalingService.onAnswer((msg) => this.handleAnswer(msg));
        this.signalingService.onCandidate((msg) => this.handleCandidate(msg));
    }

    /**
     * Create a peer connection and send an SDP offer to a display client.
     */
    async createOffer(
        displayClientId: string,
        stream: MediaStream,
        channel: string,
    ): Promise<void> {
        this.closeConnection(displayClientId);

        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        this.peerConnections.set(displayClientId, pc);
        this.activeStream = stream;
        this.activeChannel = channel;

        for (const track of stream.getTracks()) {
            pc.addTrack(track, stream);
        }

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.signalingService.sendCandidate(
                    displayClientId,
                    channel,
                    JSON.stringify(event.candidate),
                );
            }
        };

        pc.onconnectionstatechange = () => {
            this.logger.info("Connection state", {
                displayClientId,
                state: pc.connectionState,
            });

            if (
                pc.connectionState === "failed" ||
                pc.connectionState === "disconnected"
            ) {
                this.closeConnection(displayClientId);
            }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        this.signalingService.sendOffer(
            displayClientId,
            channel,
            JSON.stringify(pc.localDescription),
        );

        this.logger.info("Offer sent", { displayClientId, channel });
    }

    /**
     * Handle an SDP answer from a display client.
     */
    private async handleAnswer(msg: SignalingMessage): Promise<void> {
        const sourceClientId = msg.metadata.source;
        const pc = this.peerConnections.get(sourceClientId);
        if (!pc) {
            this.logger.warn("No peer connection for answer", {
                sourceClientId,
            });
            return;
        }

        const desc = JSON.parse(
            msg.payload.sdp ?? "",
        ) as RTCSessionDescriptionInit;
        await pc.setRemoteDescription(new RTCSessionDescription(desc));
        this.logger.info("Answer applied", { sourceClientId });
    }

    /**
     * Handle a remote ICE candidate from a display client.
     */
    private async handleCandidate(msg: SignalingMessage): Promise<void> {
        const sourceClientId = msg.metadata.source;
        const pc = this.peerConnections.get(sourceClientId);
        if (!pc) {
            return;
        }

        const candidate = JSON.parse(
            msg.payload.candidate ?? "",
        ) as RTCIceCandidateInit;
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }

    /**
     * Replace the audio track on all active peer connections.
     * Used when the effect chain changes the output stream.
     */
    async replaceTrack(newStream: MediaStream): Promise<void> {
        const newTrack = newStream.getAudioTracks()[0];
        if (!newTrack) {
            return;
        }

        this.activeStream = newStream;

        for (const [clientId, pc] of this.peerConnections) {
            const sender = pc
                .getSenders()
                .find((s) => s.track?.kind === "audio");
            if (sender) {
                await sender.replaceTrack(newTrack);
                this.logger.debug("Track replaced", { clientId });
            }
        }
    }

    /**
     * Close a single peer connection.
     */
    closeConnection(displayClientId: string): void {
        const pc = this.peerConnections.get(displayClientId);
        if (!pc) {
            return;
        }

        pc.close();
        this.peerConnections.delete(displayClientId);
        this.logger.info("Connection closed", { displayClientId });
    }

    /**
     * Close all peer connections.
     */
    closeAll(): void {
        for (const [id, pc] of this.peerConnections) {
            pc.close();
            this.logger.info("Connection closed", { displayClientId: id });
        }
        this.peerConnections.clear();
        this.activeStream = null;
        this.activeChannel = "";
    }

    isActive(): boolean {
        return this.peerConnections.size > 0;
    }

    getActiveChannel(): string {
        return this.activeChannel;
    }
}
