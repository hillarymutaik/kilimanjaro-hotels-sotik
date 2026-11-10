// Supabase mode: turned on when the build has VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
// The anon key is public by design; the database rules in supabase/schema.sql protect the data.
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const SUPABASE = Boolean(url && key);
export const supabase = SUPABASE ? createClient(url, key) : null;

/** Throws the Supabase error as a plain Error with a staff/guest-friendly message. */
export function check({ data, error }) {
  if (error) throw new Error(error.message || 'Something went wrong. Please try again.');
  return data;
}

/** Today's date in Kenya as YYYY-MM-DD, whatever the device's timezone. */
export function todayKE(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
