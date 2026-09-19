// Private, release-gated signup flow. No email address is written to analytics.
import {signupTagIds} from './signup-config.mjs';
const EMAIL = /^[^\s@]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,63}$/;
const FREEBIE = 'first-layer-checklist';
const SEGMENT_TAG = signupTagIds.segment;
const REQUEST_TAG = signupTagIds.request;

export function validateSignup(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {error:'invalid_request'};
  if (input.website) return {error:'invalid_request'}; // Honeypot.
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  if (email.length > 254 || !EMAIL.test(email)) return {error:'invalid_email'};
  if (input.consent !== true) return {error:'consent_required'};
  if (input.freebie !== FREEBIE || input.category !== 'hobbies') return {error:'resource_unavailable'};
  const source = typeof input.source === 'string' && /^[a-z0-9_-]{1,40}$/.test(input.source) ? input.source : 'website';
  return {email,source,freebie:FREEBIE,category:'hobbies'};
}

export async function signup(input, {lookup,create,addTag,readContact,record}) {
  const value = validateSignup(input);
  if (value.error) return {status:400,code:value.error};
  let contact = await lookup(value.email);
  if (contact && (contact.unsubscribed || contact.bounced || contact.suppressed || contact.needsConfirmation)) {
    return {status:202,code:'accepted'}; // Do not reveal subscription state.
  }
  // Persist consent metadata before any mutation that could trigger delivery.
  await record({email:value.email,source:value.source,freebie:value.freebie,segment:'makers_hobbies'});
  if (!contact) contact = await create(value.email);
  if (!Number.isSafeInteger(Number(contact?.id)) || Number(contact.id) < 1) throw new Error('unverified contact identity');
  // Never guess whether a duplicate request should retrigger delivery.
  if (!Array.isArray(contact.tags)) contact = await readContact(contact.id);
  if (!Array.isArray(contact?.tags)) throw new Error('contact tags unavailable');
  const ids = contact.tags.map(t => Number(typeof t === 'object' ? t.id : t));
  if (!ids.includes(SEGMENT_TAG)) await addTag(contact.id,SEGMENT_TAG);
  if (!ids.includes(REQUEST_TAG)) await addTag(contact.id,REQUEST_TAG);
  const verified = await readContact(contact.id);
  const verifiedIds = Array.isArray(verified?.tags) ? verified.tags.map(t=>Number(typeof t==='object'?t.id:t)) : [];
  if (!verifiedIds.includes(SEGMENT_TAG) || !verifiedIds.includes(REQUEST_TAG)) throw new Error('tag readback failed');
  return {status:202,code:'accepted'};
}

export {signupTagIds};
