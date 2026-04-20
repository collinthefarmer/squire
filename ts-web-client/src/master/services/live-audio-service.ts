import { BehaviorSubject, type Observable } from "rxjs";
import { Logger } from "@utils/logger";
import type { EventBus } from "@services/event-bus";
import type { ConnectionService } from "@services/connection-service";
import type { MicCaptureService } from "./mic-capture-service";
import type { WebRTCBroadcastService } from "./webrtc-broadcast-service";
import { EventBuilder } from "./event-builder";

interface ClientInfo {
    id: string;
    type: string;
}

/**
 * Live audio orchestration service
 *
 * Coordinates mic capture, WebRTC broadcasting, and audio events
 * to provide a unified "go live" / "stop live" workflow. Listens
 * for display client connect/disconnect to auto-manage peer connections.
 */
export class LiveAudioService {
    private logger = new Logger("LiveAudioService");
    private live$ = new BehaviorSubject<boolean>(false);
    private activeChannel: string | null = null;
    private displayIds: string[] = [];

    constructor(
        private connectionService: ConnectionService,
        private eventBus: EventBus,
        private micCaptureService: MicCaptureService,
        private broadcastService: WebRTCBroadcastService,
    ) {
        this.setupClientListListener();
    }

    isLive$(): Observable<boolean> {
        return this.live$.asObservable();
    }

    isLive(): boolean {
        return this.live$.value;
    }

    getActiveChannel(): string | null {
        return this.activeChannel;
    }

    /**
     * Start live audio on a channel.
     *
     * 1. Capture mic
     * 2. Send audio.play with source.type="live" so displays show the channel as active
     * 3. Create WebRTC offers to all connected displays
     */
    async goLive(channel: string, deviceId?: string): Promise<void> {
        if (this.live$.value) {
            this.logger.warn("Already live");
            return;
        }

        await this.micCaptureService.startCapture(deviceId);

        const stream = this.micCaptureService.getOutputStream();
        if (!stream) {
            this.logger.error("No output stream after capture start");
            return;
        }

        this.activeChannel = channel;
        this.live$.next(true);

        // Notify all clients that live audio is active on this channel
        const event = EventBuilder.audioPlay({
            channel,
            source: "master-mic",
            sourceType: "live",
            volume: 1.0,
            loop: false,
            respectTimeScale: true,
        });
        this.connectionService.send(event);

        // Create WebRTC connections to all known displays
        for (const displayId of this.displayIds) {
            this.broadcastService.createOffer(displayId, stream, channel).catch((err) => {
                this.logger.error("Failed to create offer", { displayId, error: err });
            });
        }

        this.logger.info("Live audio started", { channel, displays: this.displayIds.length });
    }

    /**
     * Stop live audio.
     */
    stopLive(): void {
        if (!this.live$.value || !this.activeChannel) {
            return;
        }

        const event = EventBuilder.audioStop({ channel: this.activeChannel });
        this.connectionService.send(event);

        this.broadcastService.closeAll();
        this.micCaptureService.stopCapture();

        this.logger.info("Live audio stopped", { channel: this.activeChannel });

        this.activeChannel = null;
        this.live$.next(false);
    }

    /**
     * Listen for display client list changes.
     * Auto-connect new displays when live is active.
     */
    private setupClientListListener(): void {
        this.eventBus.on("server:system.client_list", (event: unknown) => {
            const payload = (event as { payload: { displays: ClientInfo[] } }).payload;
            const newIds = payload.displays.map((d) => d.id);
            const previousIds = this.displayIds;
            this.displayIds = newIds;

            if (!this.live$.value || !this.activeChannel) {
                return;
            }

            const stream = this.micCaptureService.getOutputStream();
            if (!stream) {
                return;
            }

            // Connect newly joined displays
            for (const id of newIds) {
                if (!previousIds.includes(id)) {
                    this.broadcastService.createOffer(id, stream, this.activeChannel).catch((err) => {
                        this.logger.error("Failed to create offer for new display", { id, error: err });
                    });
                }
            }

            // Clean up disconnected displays
            for (const id of previousIds) {
                if (!newIds.includes(id)) {
                    this.broadcastService.closeConnection(id);
                }
            }
        });
    }
}
