// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import {Button} from '@mattermost/shared/components/button';
import type {AccessControlTemporaryAccess} from '@mattermost/types/access_control';

import {Client4} from 'mattermost-redux/client';

type Props = {
    temporaryAccess: AccessControlTemporaryAccess;
    onExited: () => void;
}

export default function AccessControlTemporaryAccessExpiredModal({temporaryAccess, onExited}: Props) {
    const [show, setShow] = useState(true);
    const [resourceName, setResourceName] = useState('');

    const close = useCallback(() => setShow(false), []);

    useEffect(() => {
        let cancelled = false;

        async function loadResourceName() {
            try {
                if (temporaryAccess.resource_type === 'channel') {
                    const channel = await Client4.getChannel(temporaryAccess.resource_id);
                    if (!cancelled) {
                        setResourceName(channel.display_name || channel.name);
                    }
                } else if (temporaryAccess.resource_type === 'team') {
                    const team = await Client4.getTeam(temporaryAccess.resource_id);
                    if (!cancelled) {
                        setResourceName(team.display_name || team.name);
                    }
                }
            } catch {
                // Keep the modal useful even if the resource lookup fails after removal.
            }
        }

        loadResourceName();

        return () => {
            cancelled = true;
        };
    }, [temporaryAccess.resource_id, temporaryAccess.resource_type]);

    const resourceLabel = resourceName || temporaryAccess.resource_type;

    return (
        <Modal
            dialogClassName='a11y__modal'
            show={show}
            onHide={close}
            onExited={onExited}
            role='none'
            aria-labelledby='accessControlTemporaryAccessExpiredModalLabel'
        >
            <Modal.Header closeButton={true}>
                <Modal.Title
                    componentClass='h1'
                    id='accessControlTemporaryAccessExpiredModalLabel'
                >
                    <FormattedMessage
                        id='access_control_temporary_access_expired.title'
                        defaultMessage='Temporary access ended'
                    />
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <p>
                    <FormattedMessage
                        id='access_control_temporary_access_expired.body'
                        defaultMessage='Your temporary access to {resourceName} has ended, and you have been removed.'
                        values={{resourceName: resourceLabel}}
                    />
                </p>
            </Modal.Body>
            <Modal.Footer>
                <Button
                    type='button'
                    emphasis='primary'
                    onClick={close}
                >
                    <FormattedMessage
                        id='access_control_temporary_access_expired.okay'
                        defaultMessage='Okay'
                    />
                </Button>
            </Modal.Footer>
        </Modal>
    );
}
