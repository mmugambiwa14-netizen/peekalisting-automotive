import { CameraOff } from 'lucide-react';
import BuyerPeekRequestsQueue from '@/components/peekThreads/BuyerPeekRequestsQueue';
import { featureFlags } from '@/lib/featureFlags';

export default function SellerPeekRequestsQueueLive() {
  if (!featureFlags.tours) {
    return (
      <section className="mx-4 mb-5 rounded-2xl border border-border bg-card p-5" aria-labelledby="peek-response-unavailable-heading">
        <div className="flex items-start gap-3">
          <span className="locked-icon-tile h-11 w-11 shrink-0"><CameraOff className="h-5 w-5" /></span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Response Peeks</p>
            <h2 id="peek-response-unavailable-heading" className="mt-1 text-lg font-black">Response Peek capture is not enabled yet</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Buyer Peek Request data is preserved, but sellers cannot accept or record responses in this Automotive release until the video processing and playback stack has passed its separate staging acceptance.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return <BuyerPeekRequestsQueue />;
}
