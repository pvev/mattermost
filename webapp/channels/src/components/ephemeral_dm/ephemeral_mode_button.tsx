// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import WithTooltip from 'components/with_tooltip';

import {
    requestEphemeralMode,
    endEphemeralMode,
    declineEphemeralMode,
} from 'actions/ephemeral_dm_actions';

import type {GlobalState} from 'types/store';

import './ephemeral_mode_button.scss';

type Props = {
    channelId: string;
};

const EphemeralModeButton = ({channelId}: Props) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const ephemeralState = useSelector((state: GlobalState) => state.views.ephemeralMode[channelId]);

    const status = ephemeralState?.status;

    const handleRequest = () => {
        dispatch(requestEphemeralMode(channelId));
    };

    const handleStop = () => {
        dispatch(endEphemeralMode(channelId, 'manual'));
    };

    const handleCancel = () => {
        dispatch(declineEphemeralMode(channelId));
    };

    if (status === 'active') {
        return (
            <span className='ephemeral-mode-indicator'>
                <span className='ephemeral-mode-indicator__dot'/>
                <span className='ephemeral-mode-indicator__label'>
                    {formatMessage({id: 'ephemeral_dm.active', defaultMessage: 'Ephemeral'})}
                </span>
                <WithTooltip
                    title={formatMessage({id: 'ephemeral_dm.stop', defaultMessage: 'End ephemeral mode'})}
                >
                    <button
                        className='ephemeral-mode-indicator__stop btn btn-icon btn-xs'
                        onClick={handleStop}
                        aria-label={formatMessage({id: 'ephemeral_dm.stop', defaultMessage: 'End ephemeral mode'})}
                    >
                        <i className='icon icon-close'/>
                    </button>
                </WithTooltip>
            </span>
        );
    }

    if (status === 'requested') {
        return (
            <span className='ephemeral-mode-indicator ephemeral-mode-indicator--pending'>
                <span className='ephemeral-mode-indicator__dot ephemeral-mode-indicator__dot--pending'/>
                <span className='ephemeral-mode-indicator__label'>
                    {formatMessage({id: 'ephemeral_dm.pending', defaultMessage: 'Waiting…'})}
                </span>
                <WithTooltip
                    title={formatMessage({id: 'ephemeral_dm.cancel', defaultMessage: 'Cancel request'})}
                >
                    <button
                        className='ephemeral-mode-indicator__stop btn btn-icon btn-xs'
                        onClick={handleCancel}
                        aria-label={formatMessage({id: 'ephemeral_dm.cancel', defaultMessage: 'Cancel request'})}
                    >
                        <i className='icon icon-close'/>
                    </button>
                </WithTooltip>
            </span>
        );
    }

    return (
        <WithTooltip
            title={formatMessage({id: 'ephemeral_dm.start', defaultMessage: 'Start ephemeral mode'})}
        >
            <button
                className={classNames(
                    'channel-header__icon channel-header__icon--left btn btn-icon btn-xs',
                    'ephemeral-mode-start-btn',
                )}
                onClick={handleRequest}
                aria-label={formatMessage({id: 'ephemeral_dm.start', defaultMessage: 'Start ephemeral mode'})}
            >
                <i className='icon icon-lock-outline'/>
            </button>
        </WithTooltip>
    );
};

export default EphemeralModeButton;
