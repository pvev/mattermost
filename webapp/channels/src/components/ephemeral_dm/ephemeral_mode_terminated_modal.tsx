// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {GenericModal} from '@mattermost/components';

import {acknowledgeEphemeralModeTermination} from 'actions/ephemeral_dm_actions';
import {closeModal} from 'actions/views/modals';

import {ModalIdentifiers} from 'utils/constants';

import type {GlobalState} from 'types/store';
import type {EphemeralModeTerminationReason} from 'reducers/views/ephemeral_mode';

type Props = {
    channelId: string;
};

function reasonTitle(reason: EphemeralModeTerminationReason | undefined): string {
    switch (reason) {
    case 'peer_disconnected':
        return 'Your chat partner disconnected';
    case 'inactivity':
        return 'Session timed out';
    case 'server_restart':
        return 'Session interrupted';
    default:
        return 'Ephemeral mode ended';
    }
}

function reasonBody(reason: EphemeralModeTerminationReason | undefined): string {
    switch (reason) {
    case 'peer_disconnected':
        return 'The ephemeral session ended because your chat partner left the page.';
    case 'inactivity':
        return 'The ephemeral session ended due to 1 hour of inactivity.';
    case 'server_restart':
        return 'The ephemeral session ended abruptly.';
    default:
        return 'The ephemeral session has ended.';
    }
}

const EphemeralModeTerminatedModal = ({channelId}: Props) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const ephemeralState = useSelector((state: GlobalState) => state.views.ephemeralMode[channelId]);
    const reason = ephemeralState?.terminationReason;

    const handleClose = () => {
        // Only wipe the Redux state if this session is still the one being
        // acknowledged.  If a new session was started while this modal was
        // open (request arrived → accepted), skip the cleanup so the new
        // active session is not destroyed.
        if (ephemeralState?.status === 'terminated') {
            dispatch(acknowledgeEphemeralModeTermination(channelId));
        }
        dispatch(closeModal(ModalIdentifiers.EPHEMERAL_MODE_TERMINATED));
    };

    return (
        <GenericModal
            id='ephemeralModeTerminatedModal'
            compassDesign={true}
            onExited={handleClose}
            modalHeaderText={reasonTitle(reason)}
            confirmButtonText={formatMessage({id: 'ephemeral_dm.terminated_modal.got_it', defaultMessage: 'Got it'})}
            handleConfirm={handleClose}
            handleCancel={undefined}
        >
            <p>
                {reasonBody(reason)}
                {' '}
                {formatMessage({
                    id: 'ephemeral_dm.terminated_modal.warning',
                    defaultMessage: 'Any messages you send from now on will be saved normally.',
                })}
            </p>
        </GenericModal>
    );
};

export default EphemeralModeTerminatedModal;
