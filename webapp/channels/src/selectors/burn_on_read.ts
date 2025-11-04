// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/common';
import {getInt} from 'mattermost-redux/selectors/entities/preferences';

import type {GlobalState} from 'types/store';

// Preference category for tour tip
export const BURN_ON_READ_TOUR_TIP_PREFERENCE = 'burn_on_read_tour_tip';

/**
 * Check if BoR feature is enabled
 */
export const isBurnOnReadEnabled = (state: GlobalState): boolean => {
    const config = getConfig(state);
    return config.EnableBurnOnRead === 'true';
};

/**
 * Get BoR duration in minutes
 */
export const getBurnOnReadDurationMinutes = (state: GlobalState): number => {
    const config = getConfig(state);
    return parseInt(config.BurnOnReadDurationMinutes || '10', 10);
};

/**
 * Check if current user can send BoR messages
 * For now, all users can send BoR messages when the feature is enabled
 * User granularity restriction is disabled for MVP
 */
export const canUserSendBurnOnRead = (state: GlobalState): boolean => {
    // For MVP: All users can send BoR when feature is enabled
    return isBurnOnReadEnabled(state);
};

/**
 * Check if user has seen the BoR tour tip
 */
export const hasSeenBurnOnReadTourTip = (state: GlobalState): boolean => {
    const currentUserId = getCurrentUserId(state);
    const value = getInt(state, BURN_ON_READ_TOUR_TIP_PREFERENCE, currentUserId, 0);
    return value === 1; // 1 = seen, 0 = not seen
};
