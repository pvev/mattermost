// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useRef} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {endEphemeralMode} from 'actions/ephemeral_dm_actions';

import type {GlobalState} from 'types/store';

const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour

/**
 * Manages the lifecycle of an active ephemeral DM session for a given channel.
 *
 * Responsibilities:
 *  - Starts a 1-hour inactivity timer that calls the end endpoint on expiry.
 *    The timer is reset each time the hook detects a new message in the channel
 *    (via the `lastMessageAt` prop supplied by the consumer).
 *
 * Tab/page close is handled server-side: the backend's web_hub detects WebSocket
 * disconnects and calls OnUserDisconnectedForEphemeralDM automatically. We do NOT
 * use navigator.sendBeacon here to avoid unauthenticated requests that can trigger
 * unexpected server-side behaviour (including session invalidation).
 *
 * The hook is a no-op when no ephemeral session is active in `channelId`.
 */
export function useEphemeralModeSession(channelId: string, lastMessageAt?: number) {
    const dispatch = useDispatch();
    const status = useSelector((state: GlobalState) => state.views.ephemeralMode[channelId]?.status);
    const isActive = status === 'active';

    const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearInactivityTimer = () => {
        if (inactivityTimer.current !== null) {
            clearTimeout(inactivityTimer.current);
            inactivityTimer.current = null;
        }
    };

    const startInactivityTimer = () => {
        clearInactivityTimer();
        inactivityTimer.current = setTimeout(() => {
            dispatch(endEphemeralMode(channelId, 'inactivity'));
        }, INACTIVITY_TIMEOUT_MS);
    };

    // Reset the inactivity timer whenever a new message is sent
    useEffect(() => {
        if (!isActive) {
            return;
        }
        startInactivityTimer();
    }, [lastMessageAt, isActive]); // eslint-disable-line react-hooks/exhaustive-deps

    // Start or stop the inactivity timer based on active state
    useEffect(() => {
        if (!isActive) {
            clearInactivityTimer();
            return undefined;
        }

        startInactivityTimer();

        return () => {
            clearInactivityTimer();
        };
    }, [isActive, channelId]); // eslint-disable-line react-hooks/exhaustive-deps
}
