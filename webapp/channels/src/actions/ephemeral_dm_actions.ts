// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';

import {receivedNewPost, removePost} from 'mattermost-redux/actions/posts';
import {Client4} from 'mattermost-redux/client';

import {ActionTypes} from 'utils/constants';

import type {ActionFuncAsync} from 'types/store';

function getEphemeralModeRoute(channelId: string) {
    return `${Client4.getChannelRoute(channelId)}/ephemeral-mode`;
}

export function requestEphemeralMode(channelId: string): ActionFuncAsync {
    return async (dispatch) => {
        try {
            await Client4.doFetch(
                `${getEphemeralModeRoute(channelId)}/request`,
                {method: 'post'},
            );
            return {data: true};
        } catch (error) {
            return {error};
        }
    };
}

export function acceptEphemeralMode(channelId: string): ActionFuncAsync {
    return async (dispatch) => {
        try {
            await Client4.doFetch(
                `${getEphemeralModeRoute(channelId)}/accept`,
                {method: 'post'},
            );
            return {data: true};
        } catch (error) {
            return {error};
        }
    };
}

export function declineEphemeralMode(channelId: string): ActionFuncAsync {
    return async (dispatch) => {
        try {
            await Client4.doFetch(
                `${getEphemeralModeRoute(channelId)}/decline`,
                {method: 'post'},
            );
            return {data: true};
        } catch (error) {
            return {error};
        }
    };
}

export function endEphemeralMode(channelId: string, reason = 'manual'): ActionFuncAsync {
    return async (dispatch) => {
        try {
            await Client4.doFetch(
                `${getEphemeralModeRoute(channelId)}/end`,
                {method: 'post', body: JSON.stringify({reason})},
            );
            return {data: true};
        } catch (error) {
            return {error};
        }
    };
}

export function sendEphemeralDMPost(channelId: string, post: Partial<Post>): ActionFuncAsync {
    return async (dispatch) => {
        try {
            const data = await Client4.doFetch<Post>(
                `${getEphemeralModeRoute(channelId)}/posts`,
                {method: 'post', body: JSON.stringify(post)},
            );
            if (data) {
                dispatch(receivedNewPost(data, false));
            }
            return {data};
        } catch (error) {
            return {error};
        }
    };
}

// Redux actions dispatched from WS event handlers
export function ephemeralModeRequested(channelId: string, requestedBy: string) {
    return {
        type: ActionTypes.EPHEMERAL_MODE_REQUESTED,
        channelId,
        requestedBy,
    };
}

export function ephemeralModeActivated(channelId: string) {
    return {
        type: ActionTypes.EPHEMERAL_MODE_ACTIVE,
        channelId,
    };
}

export function ephemeralModeTerminated(channelId: string, reason: string) {
    return {
        type: ActionTypes.EPHEMERAL_MODE_TERMINATED,
        channelId,
        reason,
    };
}

export function acknowledgeEphemeralModeTermination(channelId: string) {
    return {
        type: ActionTypes.EPHEMERAL_MODE_ACKNOWLEDGE,
        channelId,
    };
}

/**
 * Dispatches removePost for every post in the given channel that has
 * `props.ephemeral_dm === true`, effectively wiping the ephemeral
 * conversation from the post list once the session ends.
 */
export function clearEphemeralDMPosts(channelId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        const state = getState();
        const blocks = state.entities.posts.postsInChannel[channelId];
        if (!blocks) {
            return {data: true};
        }

        const allPostIds = blocks.flatMap((block) => block.order);
        for (const postId of allPostIds) {
            const post = state.entities.posts.posts[postId];
            if (post?.props?.ephemeral_dm === true) {
                dispatch(removePost(post));
            }
        }
        return {data: true};
    };
}
