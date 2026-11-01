// Message and log retention (server settings). 0 = keep forever.
// Upper bounds only guard against typos; anything beyond them is
// effectively "forever" anyway.
export const RETENTION_MAX_COUNT = 1_000_000;
export const RETENTION_MAX_DAYS = 36_500; // 100 years
