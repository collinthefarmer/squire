import { Logger } from "@utils/logger";
import type { EventBus } from "@services/event-bus";
import type { ConnectionService } from "@services/connection-service";

interface SignalingPayload {
    targetClientId: string;
    channel: string;
    sdp?: string;
    candidate?: string;
}

export interface SignalingMessage {
    type: string;
    payload: SignalingPayload;
    metadata: { source: string };
}

/**
 * WebRTC signaling service
 *
 * Sends and receives WebRTC signaling messages (SDP offers/answers,
 * ICE candidates) over the existing WebSocket connection. The server
 * relays these to the targeted client without storing them.
 */
export class WebRTCSignalingService {
    private logger = new Logger("WebRTCSignalingService");

    private onOfferCallback: ((msg: SignalingMessage) => void) | null = null;
    private onAnswerCallback: ((msg: SignalingMessage) => void) | null = null;
    private onCandidateCallback: ((msg: SignalingMessage) => void) | null = null;

    constructor(
        private connectionService: ConnectionService,
        private eventBus: EventBus,
    ) {
        this.setupListeners();
    }

    onOffer(callback: (msg: SignalingMessage) => void): void {
        this.onOfferCallback = callback;
    }

    onAnswer(callback: (msg: SignalingMessage) => void): void {
        this.onAnswerCallback = callback;
    }

    onCandidate(callback: (msg: SignalingMessage) => void): void {
        this.onCandidateCallback = callback;
    }

    sendOffer(targetClientId: string, channel: string, sdp: string): void {
        this.send("webrtc.offer", { targetClientId, channel, sdp });
    }

    sendAnswer(targetClientId: string, channel: string, sdp: string): void {
        this.send("webrtc.answer", { targetClientId, channel, sdp });
    }

    sendCandidate(targetClientId: string, channel: string, candidate: string): void {
        this.send("webrtc.ice_candidate", { targetClientId, channel, candidate });
    }

    private send(type: string, payload: SignalingPayload): void {
        this.connectionService.send({
            type,
            payload,
            metadata: { timestamp: Date.now(), source: "client" },
        });
    }

    private setupListeners(): void {
        this.eventBus.on("server:webrtc.offer", (msg: unknown) => {
            this.logger.debug("Received offer");
            this.onOfferCallback?.(msg as SignalingMessage);
        });

        this.eventBus.on("server:webrtc.answer", (msg: unknown) => {
            this.logger.debug("Received answer");
            this.onAnswerCallback?.(msg as SignalingMessage);
        });

        this.eventBus.on("server:webrtc.ice_candidate", (msg: unknown) => {
            this.logger.debug("Received ICE candidate");
            this.onCandidateCallback?.(msg as SignalingMessage);
        });
    }
}
