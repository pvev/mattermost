// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import {Button} from '@mattermost/shared/components/button';
import type {AccessControlBypass} from '@mattermost/types/access_control';

import Client4 from 'mattermost-redux/client/client4';

import {getHistory} from 'utils/browser_history';

type Props = {
    bypass: AccessControlBypass;
    onExited: () => void;
}

export default function AccessControlBypassInviteModal({bypass, onExited}: Props) {
    const [show, setShow] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(false);

    const close = useCallback(() => setShow(false), []);

    const accept = useCallback(async () => {
        setSaving(true);
        setError(false);
        try {
            await Client4.acceptAccessControlBypass(bypass.id);
            if (bypass.resource_type === 'channel') {
                const channel = await Client4.getChannel(bypass.resource_id);
                const team = channel.team_id ? await Client4.getTeam(channel.team_id) : null;
                if (team) {
                    getHistory().push(`/${team.name}/channels/${channel.name}`);
                }
            } else if (bypass.resource_type === 'team') {
                const team = await Client4.getTeam(bypass.resource_id);
                getHistory().push(`/${team.name}`);
            }
            close();
        } catch {
            setError(true);
        } finally {
            setSaving(false);
        }
    }, [bypass, close]);

    return (
        <Modal
            dialogClassName='a11y__modal'
            show={show}
            onHide={close}
            onExited={onExited}
            role='none'
            aria-labelledby='accessControlBypassInviteModalLabel'
        >
            <Modal.Header closeButton={true}>
                <Modal.Title
                    componentClass='h1'
                    id='accessControlBypassInviteModalLabel'
                >
                    <FormattedMessage
                        id='access_control_bypass_invite.title'
                        defaultMessage='Temporary access granted'
                    />
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <p>
                    <FormattedMessage
                        id='access_control_bypass_invite.body'
                        defaultMessage='You have temporary access to this {resourceType} until {expiresAt}.'
                        values={{
                            resourceType: bypass.resource_type,
                            expiresAt: new Date(bypass.expires_at).toLocaleString(),
                        }}
                    />
                </p>
                <p>{bypass.reason}</p>
                {error && (
                    <p className='has-error'>
                        <FormattedMessage
                            id='access_control_bypass_invite.error'
                            defaultMessage='Unable to join this resource. Try again later.'
                        />
                    </p>
                )}
            </Modal.Body>
            <Modal.Footer>
                <Button
                    type='button'
                    onClick={close}
                >
                    <FormattedMessage
                        id='access_control_bypass_invite.dismiss'
                        defaultMessage='Not now'
                    />
                </Button>
                <Button
                    type='button'
                    emphasis='primary'
                    onClick={accept}
                    disabled={saving}
                >
                    <FormattedMessage
                        id='access_control_bypass_invite.accept'
                        defaultMessage='Join'
                    />
                </Button>
            </Modal.Footer>
        </Modal>
    );
}
