// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import {Button} from '@mattermost/shared/components/button';
import type {AccessControlTemporaryAccess} from '@mattermost/types/access_control';

import {Client4} from 'mattermost-redux/client';

import {getHistory} from 'utils/browser_history';

type Props = {
    temporaryAccess?: AccessControlTemporaryAccess;
    temporaryAccesses?: AccessControlTemporaryAccess[];
    onExited: () => void;
}

type ResourceInvite = {
    key: string;
    type: 'channel' | 'team';
    label: string;
    expiresAt: number;
};

export default function AccessControlTemporaryAccessInviteModal({temporaryAccess, temporaryAccesses, onExited}: Props) {
    const invites = useMemo(() => temporaryAccesses ?? (temporaryAccess ? [temporaryAccess] : []), [temporaryAccess, temporaryAccesses]);
    const [show, setShow] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(false);
    const [resourceInvites, setResourceInvites] = useState<ResourceInvite[]>([]);

    useEffect(() => {
        let active = true;

        async function loadResourceInvites() {
            const loadedInvites: ResourceInvite[] = [];
            const addedResources = new Set<string>();
            let myTeamIds = new Set<string>();

            try {
                const myTeamMembers = await Client4.getMyTeamMembers();
                myTeamIds = new Set(myTeamMembers.filter((member) => member.delete_at === 0).map((member) => member.team_id));
            } catch {
                // If team membership lookup fails, still show the explicitly invited resources.
            }

            for (const invite of invites) {
                try {
                    if (invite.resource_type === 'team') {
                        const team = await Client4.getTeam(invite.resource_id);
                        const key = `team-${team.id}`;
                        if (!addedResources.has(key)) {
                            addedResources.add(key);
                            loadedInvites.push({
                                key,
                                type: 'team',
                                label: team.display_name || team.name,
                                expiresAt: invite.expires_at,
                            });
                        }
                    } else if (invite.resource_type === 'channel') {
                        const channel = await Client4.getChannel(invite.resource_id);
                        if (channel.team_id && (invite.team_membership_created || !myTeamIds.has(channel.team_id))) {
                            const team = await Client4.getTeam(channel.team_id);
                            const teamKey = `team-${team.id}`;
                            if (!addedResources.has(teamKey)) {
                                addedResources.add(teamKey);
                                loadedInvites.push({
                                    key: teamKey,
                                    type: 'team',
                                    label: team.display_name || team.name,
                                    expiresAt: invite.expires_at,
                                });
                            }
                        }

                        const key = `channel-${channel.id}`;
                        if (!addedResources.has(key)) {
                            addedResources.add(key);
                            loadedInvites.push({
                                key,
                                type: 'channel',
                                label: channel.display_name || channel.name,
                                expiresAt: invite.expires_at,
                            });
                        }
                    }
                } catch {
                    const key = `${invite.resource_type}-${invite.resource_id}`;
                    if (!addedResources.has(key)) {
                        addedResources.add(key);
                        loadedInvites.push({
                            key,
                            type: invite.resource_type === 'team' ? 'team' : 'channel',
                            label: invite.resource_id,
                            expiresAt: invite.expires_at,
                        });
                    }
                }
            }

            if (active) {
                setResourceInvites(loadedInvites);
            }
        }

        loadResourceInvites();

        return () => {
            active = false;
        };
    }, [invites]);

    const close = useCallback(() => setShow(false), []);

    const accept = useCallback(async () => {
        setSaving(true);
        setError(false);
        try {
            const acceptedTemporaryAccesses = await Promise.all(invites.map((invite) => Client4.acceptAccessControlTemporaryAccess(invite.id)));
            const channelTemporaryAccess = acceptedTemporaryAccesses.find((invite) => invite.resource_type === 'channel');
            const teamTemporaryAccess = acceptedTemporaryAccesses.find((invite) => invite.resource_type === 'team');
            if (channelTemporaryAccess) {
                const channel = await Client4.getChannel(channelTemporaryAccess.resource_id);
                const team = channel.team_id ? await Client4.getTeam(channel.team_id) : null;
                if (team) {
                    getHistory().push(`/${team.name}/channels/${channel.name}`);
                }
            } else if (teamTemporaryAccess) {
                const team = await Client4.getTeam(teamTemporaryAccess.resource_id);
                getHistory().push(`/${team.name}`);
            }
            close();
        } catch {
            setError(true);
        } finally {
            setSaving(false);
        }
    }, [close, invites]);

    return (
        <Modal
            dialogClassName='a11y__modal'
            show={show}
            onHide={close}
            onExited={onExited}
            role='none'
            aria-labelledby='accessControlTemporaryAccessInviteModalLabel'
        >
            <Modal.Header closeButton={true}>
                <Modal.Title
                    componentClass='h1'
                    id='accessControlTemporaryAccessInviteModalLabel'
                >
                    <FormattedMessage
                        id='access_control_temporary_access_invite.title'
                        defaultMessage='Temporary access granted'
                    />
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <p>
                    <FormattedMessage
                        id='access_control_temporary_access_invite.body'
                        defaultMessage='You have been temporarily added to:'
                    />
                </p>
                <ul>
                    {(resourceInvites.length > 0 ? resourceInvites : invites.map((invite) => ({
                        key: `${invite.resource_type}-${invite.resource_id}`,
                        type: invite.resource_type === 'team' ? 'team' as const : 'channel' as const,
                        label: invite.resource_id,
                        expiresAt: invite.expires_at,
                    }))).map((invite) => (
                        <li key={invite.key}>
                            <FormattedMessage
                                id='access_control_temporary_access_invite.resource'
                                defaultMessage='{resourceType}: {resourceName} until {expiresAt}'
                                values={{
                                    resourceType: invite.type === 'team' ? (
                                        <FormattedMessage
                                            id='access_control_temporary_access_invite.resource.team'
                                            defaultMessage='team'
                                        />
                                    ) : (
                                        <FormattedMessage
                                            id='access_control_temporary_access_invite.resource.channel'
                                            defaultMessage='channel'
                                        />
                                    ),
                                    resourceName: invite.label,
                                    expiresAt: new Date(invite.expiresAt).toLocaleString(),
                                }}
                            />
                        </li>
                    ))}
                </ul>
                {invites[0]?.reason && (
                    <p>
                        <FormattedMessage
                            id='access_control_temporary_access_invite.reason'
                            defaultMessage='Reason: {reason}'
                            values={{reason: invites[0].reason}}
                        />
                    </p>
                )}
                {error && (
                    <p className='has-error'>
                        <FormattedMessage
                            id='access_control_temporary_access_invite.error'
                            defaultMessage='Unable to open these resources. Try again later.'
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
                        id='access_control_temporary_access_invite.dismiss'
                        defaultMessage='Not now'
                    />
                </Button>
                <Button
                    type='button'
                    emphasis='primary'
                    onClick={accept}
                    disabled={saving || invites.length === 0}
                >
                    <FormattedMessage
                        id='access_control_temporary_access_invite.accept'
                        defaultMessage='Open'
                    />
                </Button>
            </Modal.Footer>
        </Modal>
    );
}
