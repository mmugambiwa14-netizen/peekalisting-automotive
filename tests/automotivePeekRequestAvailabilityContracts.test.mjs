import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [service, threads, sellerQueue, workflow, uploader, databaseInterlock] = await Promise.all([
  readFile(new URL('../src/services/peekThreadsService.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/peekThreads/PeekThreadsSection.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/peekThreads/SellerPeekRequestsQueueLive.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../.github/workflows/automotive-staging.yml', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/tours/TourUploader.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/migrations/20260811060000_peek_request_release_interlock.sql', import.meta.url), 'utf8'),
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

test('buyer Peek threads become read-only instead of advertising dead response actions', () => {
  assert.match(threads, /const requestsWritable = featureFlags\.tours/);
  assert.match(threads, /Peek Requests are temporarily read-only while Response Peek capture is being prepared for Automotive/);
  assert.match(threads, /!isOwner && requestsWritable[\s\S]*Request a Peek/);
  assert.match(threads, /requestsWritable && composerOpen && !isOwner/);
  assert.match(threads, /Response Peek capture is being prepared/);
  assert.match(threads, /New Peek Requests will open after the response pipeline passes Automotive staging acceptance/);
  assert.match(threads, /\(requestsWritable \|\| item\.supportedByMe\)/);
  assert.match(threads, /isOwner && requestsWritable[\s\S]*Record response/);
});

test('database rejects direct Peek demand writes while the Tours backend control is disabled', () => {
  assert.match(databaseInterlock, /marketplace_feature_controls/);
  assert.match(databaseInterlock, /feature_key = 'tours'/);
  assert.match(databaseInterlock, /control\.enabled/);
  assert.match(databaseInterlock, /create or replace function private\.create_peek_request/);
  assert.match(databaseInterlock, /create or replace function private\.support_peek_request/);
  assert.match(databaseInterlock, /create or replace function private\.accept_peek_request/);
  assert.match(databaseInterlock, /Peek Requests are temporarily unavailable while Response Peek capture is disabled/);
  assert.match(databaseInterlock, /Response Peek capture is not enabled in this environment/);
  assert.match(databaseInterlock, /errcode = '55000'/);
  assert.match(databaseInterlock, /expected Tours to remain disabled/);
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
