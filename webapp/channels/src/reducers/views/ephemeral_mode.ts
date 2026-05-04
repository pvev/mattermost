// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ActionTypes} from 'utils/constants';

import type {MMAction} from 'types/store';

export type EphemeralModeTerminationReason = 'manual' | 'peer_disconnected' | 'inactivity' | 'server_restart';

export type EphemeralModeStatus = 'requested' | 'active' | 'terminated';

export type EphemeralModeChannelState = {
    status: EphemeralModeStatus;
    requestedBy: string;
    terminationReason?: EphemeralModeTerminationReason;
    requiresAcknowledgement: boolean;
};

export type EphemeralModeState = {
    [channelId: string]: EphemeralModeChannelState;
};

const initialState: EphemeralModeState = {};

export default function ephemeralMode(state: EphemeralModeState = initialState, action: MMAction): EphemeralModeState {
    switch (action.type) {
    case ActionTypes.EPHEMERAL_MODE_REQUESTED: {
        return {
            ...state,
            [action.channelId]: {
                status: 'requested',
                requestedBy: action.requestedBy,
                requiresAcknowledgement: false,
            },
        };
    }
    case ActionTypes.EPHEMERAL_MODE_ACTIVE: {
        return {
            ...state,
            [action.channelId]: {
                ...(state[action.channelId] ?? {requestedBy: ''}),
                status: 'active',
                requiresAcknowledgement: false,
            },
        };
    }
    case ActionTypes.EPHEMERAL_MODE_TERMINATED: {
        const current = state[action.channelId];
        return {
            ...state,
            [action.channelId]: {
                ...(current ?? {requestedBy: '', requiresAcknowledgement: false}),
                status: 'terminated',
                terminationReason: action.reason as EphemeralModeTerminationReason,
                requiresAcknowledgement: true,
            },
        };
    }
    case ActionTypes.EPHEMERAL_MODE_ACKNOWLEDGE: {
        const current = state[action.channelId];
        if (!current) {
            return state;
        }
        const nextState = {...state};
        delete nextState[action.channelId];
        return nextState;
    }
    default:
        return state;
    }
}
