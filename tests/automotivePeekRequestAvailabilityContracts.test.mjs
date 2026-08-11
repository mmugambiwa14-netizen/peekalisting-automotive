import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [service, sellerQueue, workflow, uploader] = await Promise.all([
  readFile(new URL('../src/services/peekThreadsService.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/peekThreads/SellerPeekRequestsQueueLive.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../.github/workflows/automotive-staging.yml', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/tours/TourUploader.jsx', import.meta.url), 'utf8'),
]);

test('automotive does not create new unfulfillable Peek demand while Response Peek capture is disabled', () => {
  assert.match(service, /featureFlags/);
  assert.match(service, /requireResponsePeekCapture/);
  assert.match(service, /PEEK_RESPONSE_CAPTURE_UNAVAILABLE/);
  assert.match(service, /Peek Requests are temporarily unavailable while Response Peek capture is being prepared for Automotive/);
  assert.match(service, /createPeekRequest\(input\)[\s\S]*requireResponsePeekCapture\(\)/);
  assert.match(service, /supportPeekRequest\(requestId\)[\s\S]*requireResponsePeekCapture\(\)/);
  assert.match(service, /acceptPeekRequest\(requestId\)[\s\S]*requireResponsePeekCapture\(\)/);
});

test('seller request queue explains the release boundary instead of exposing a dead response control', () => {
  assert.match(sellerQueue, /featureFlags\.tours/);
  assert.match(sellerQueue, /Response Peek capture is not enabled yet/);
  assert.match(sellerQueue, /video processing and playback stack has passed its separate staging acceptance/);
  assert.match(sellerQueue, /return <BuyerPeekRequestsQueue \/>/);
});

test('the gate is tied to the same Tours capability that hides the actual uploader', () => {
  assert.match(uploader, /if \(!featureFlags\.tours\) return null/);
  assert.match(workflow, /VITE_FEATURE_TOURS:\s*"false"/);
  assert.match(workflow, /TOURS_BACKEND_ENABLED:\s*"false"/);
});
