// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {getCurrentChannelId, getCurrentUserId} from 'mattermost-redux/selectors/entities/common';
import {getLimitedViews, getPost} from 'mattermost-redux/selectors/entities/posts';

import {emitShortcutReactToLastPostFrom} from 'actions/post_actions';
import {getShortcutReactToLastPostEmittedFrom} from 'selectors/emojis';

import {PostListRowListIds} from 'utils/constants';

import type {GlobalState} from 'types/store';

import PostListRow from './post_list_row';
import type {PostListRowProps} from './post_list_row';

type OwnProps = Pick<PostListRowProps, 'listId' | 'previousListId'>

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    const shortcutReactToLastPostEmittedFrom = getShortcutReactToLastPostEmittedFrom(state);
    const post = getPost(state, ownProps.listId);
    const previousPost = ownProps.previousListId ? getPost(state, ownProps.previousListId) : undefined;
    const currentUserId = getCurrentUserId(state);
    const newMessagesSeparatorActions = state.plugins.components.NewMessagesSeparatorAction;

    // Show the ephemeral mode separator before the first ephemeral DM post in the list
    const isFirstEphemeralDMPost =
        post?.props?.ephemeral_dm === true &&
        previousPost?.props?.ephemeral_dm !== true;

    const props: Pick<
    PostListRowProps,
    'shortcutReactToLastPostEmittedFrom'| 'exceededLimitChannelId' | 'firstInaccessiblePostTime' | 'post' | 'currentUserId' | 'newMessagesSeparatorActions' | 'isFirstEphemeralDMPost'
    > = {
        shortcutReactToLastPostEmittedFrom,
        post,
        currentUserId,
        newMessagesSeparatorActions,
        isFirstEphemeralDMPost,
    };
    if ((ownProps.listId === PostListRowListIds.OLDER_MESSAGES_LOADER || ownProps.listId === PostListRowListIds.CHANNEL_INTRO_MESSAGE)) {
        const currentChannelId = getCurrentChannelId(state);
        const firstInaccessiblePostTime = getLimitedViews(state).channels[currentChannelId];
        const channelLimitExceeded = Boolean(firstInaccessiblePostTime) || firstInaccessiblePostTime === 0;
        if (channelLimitExceeded) {
            props.exceededLimitChannelId = currentChannelId;
            props.firstInaccessiblePostTime = firstInaccessiblePostTime;
        }
    }
    return props;
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            emitShortcutReactToLastPostFrom,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(PostListRow);
