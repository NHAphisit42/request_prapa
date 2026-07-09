"use client";

import liff from "@line/liff";

let liffInitPromise: Promise<void> | null = null;

function initLiff(liffId: string): Promise<void> {
  if (!liffInitPromise) {
    liffInitPromise = liff.init({ liffId }).catch((err) => {
      liffInitPromise = null; // allow retrying on next call
      throw err;
    });
  }
  return liffInitPromise;
}

export type LiffProfile = {
  userId: string;
  displayName: string;
  pictureUrl?: string;
};

/**
 * Initializes LIFF and returns the current user's profile.
 * Returns `null` if the user needs to be redirected to LINE login
 * (liff.login() triggers a redirect, so there's nothing to return yet).
 * Throws if LIFF fails to initialize (e.g. missing/invalid LIFF ID).
 */
export async function getLiffProfile(liffId: string): Promise<LiffProfile | null> {
  await initLiff(liffId);

  if (!liff.isLoggedIn()) {
    liff.login();
    return null;
  }

  const profile = await liff.getProfile();
  return {
    userId: profile.userId,
    displayName: profile.displayName,
    pictureUrl: profile.pictureUrl,
  };
}
