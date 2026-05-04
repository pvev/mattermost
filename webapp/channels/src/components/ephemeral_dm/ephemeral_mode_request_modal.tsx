// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl, FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {GenericModal} from '@mattermost/components';

import {getCurrentUserId, getUser} from 'mattermost-redux/selectors/entities/users';

import {
    acceptEphemeralMode,
    declineEphemeralMode,
} from 'actions/ephemeral_dm_actions';
import {closeModal} from 'actions/views/modals';

import {ModalIdentifiers} from 'utils/constants';

import type {GlobalState} from 'types/store';

type Props = {
    channelId: string;
};

/**
 * Modal shown to the peer who received an ephemeral mode request.
 * Uses GenericModal (CompassUI) for consistency with Mattermost design.
 */
const EphemeralModeRequestModal = ({channelId}: Props) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const currentUserId = useSelector(getCurrentUserId);
    const ephemeralState = useSelector((state: GlobalState) => state.views.ephemeralMode[channelId]);
    const requestedBy = ephemeralState?.requestedBy ?? '';
    const requester = useSelector((state: GlobalState) => getUser(state, requestedBy));

    if (ephemeralState?.status !== 'requested' || requestedBy === currentUserId) {
        return null;
    }

    const requesterName = requester?.username ?? requestedBy;

    const handleAccept = () => {
        dispatch(acceptEphemeralMode(channelId));
        dispatch(closeModal(ModalIdentifiers.EPHEMERAL_MODE_REQUEST));
    };

    const handleDecline = () => {
        dispatch(declineEphemeralMode(channelId));
        dispatch(closeModal(ModalIdentifiers.EPHEMERAL_MODE_REQUEST));
    };

    return (
        <GenericModal
            id='ephemeralModeRequestModal'
            compassDesign={true}
            onExited={handleDecline}
            modalHeaderText={
                <FormattedMessage
                    id='ephemeral_dm.request_modal.title'
                    defaultMessage='Start ephemeral mode?'
                />
            }
            confirmButtonText={formatMessage({id: 'ephemeral_dm.accept', defaultMessage: 'Accept'})}
            cancelButtonText={formatMessage({id: 'ephemeral_dm.decline', defaultMessage: 'Decline'})}
            handleConfirm={handleAccept}
            handleCancel={handleDecline}
        >
            <p>
                <FormattedMessage
                    id='ephemeral_dm.request_modal.body'
                    defaultMessage='<strong>{name}</strong> wants to start an ephemeral conversation. Messages sent in this mode will not be saved to the server.'
                    values={{
                        name: requesterName,
                        strong: (chunks: React.ReactNode) => <strong>{chunks}</strong>,
                    }}
                />
            </p>
        </GenericModal>
    );
};

export default EphemeralModeRequestModal;
