// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {FormattedMessage, defineMessages, useIntl} from 'react-intl';
import type {MultiValue} from 'react-select';
import ReactSelect from 'react-select';
import CreatableSelect from 'react-select/creatable';

import type {AccessControlBypass, AccessControlBypassResource} from '@mattermost/types/access_control';

import Client4 from 'mattermost-redux/client/client4';

import FormError from 'components/form_error';
import LoadingScreen from 'components/loading_screen';
import SaveButton from 'components/save_button';

import {UserSelector} from '../../content_flagging/user_multiselector/user_multiselector';

type Option = {
    value: string;
    label: string;
}

const messages = defineMessages({
    title: {id: 'admin.access_control_bypasses.title', defaultMessage: 'Temporary ABAC bypasses'},
    description: {id: 'admin.access_control_bypasses.description', defaultMessage: 'Grant temporary ABAC-only access to selected users for specific teams or channels without changing user attributes.'},
    users: {id: 'admin.access_control_bypasses.users', defaultMessage: 'Users'},
    resources: {id: 'admin.access_control_bypasses.resources', defaultMessage: 'Resources'},
    resourcesHelp: {id: 'admin.access_control_bypasses.resourcesHelp', defaultMessage: 'Add resources as team:<id> or channel:<id>. Each selected resource is clearly tagged by type.'},
    duration: {id: 'admin.access_control_bypasses.duration', defaultMessage: 'Duration'},
    reason: {id: 'admin.access_control_bypasses.reason', defaultMessage: 'Reason'},
    inviteMode: {id: 'admin.access_control_bypasses.inviteMode', defaultMessage: 'Invite behavior'},
    create: {id: 'admin.access_control_bypasses.create', defaultMessage: 'Create bypass'},
    revoke: {id: 'admin.access_control_bypasses.revoke', defaultMessage: 'Revoke'},
    noBypasses: {id: 'admin.access_control_bypasses.noBypasses', defaultMessage: 'No bypasses found.'},
    saveError: {id: 'admin.access_control_bypasses.saveError', defaultMessage: 'Unable to save the bypass. Check the selected users, resources, duration, and reason.'},
    loadError: {id: 'admin.access_control_bypasses.loadError', defaultMessage: 'Unable to load active bypasses.'},
    revokeError: {id: 'admin.access_control_bypasses.revokeError', defaultMessage: 'Unable to revoke the bypass.'},
});

const durationOptions = [
    {value: '60', label: '1 hour'},
    {value: '240', label: '4 hours'},
    {value: '1440', label: '1 day'},
    {value: '10080', label: '7 days'},
];

const inviteModeOptions = [
    {value: 'none', label: 'No notification'},
    {value: 'prompt', label: 'Prompt user to join'},
];

function parseResourceOption(option: Option): AccessControlBypassResource | null {
    const [rawType, rawId] = option.value.split(':');
    const type = rawType.trim();
    const id = rawId?.trim();
    if ((type !== 'team' && type !== 'channel') || !id) {
        return null;
    }
    return {type, id};
}

function formatTimestamp(timestamp: number): string {
    if (!timestamp) {
        return '';
    }
    return new Date(timestamp).toLocaleString();
}

export default function AccessControlBypasses() {
    const {formatMessage} = useIntl();
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [resourceOptions, setResourceOptions] = useState<Option[]>([]);
    const [durationMinutes, setDurationMinutes] = useState<Option>(durationOptions[0]);
    const [inviteMode, setInviteMode] = useState<Option>(inviteModeOptions[0]);
    const [reason, setReason] = useState('');
    const [bypasses, setBypasses] = useState<AccessControlBypass[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const resources = useMemo(() => resourceOptions.map(parseResourceOption).filter(Boolean) as AccessControlBypassResource[], [resourceOptions]);

    const loadBypasses = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await Client4.searchAccessControlBypasses({status: 'active', page: 0, per_page: 50});
            setBypasses(result.bypasses);
        } catch {
            setError(formatMessage(messages.loadError));
        } finally {
            setLoading(false);
        }
    }, [formatMessage]);

    useEffect(() => {
        loadBypasses();
    }, [loadBypasses]);

    const handleResourceChange = useCallback((value: MultiValue<Option>) => {
        setResourceOptions(value.map((option) => {
            const resource = parseResourceOption(option);
            if (!resource) {
                return option;
            }
            return {
                value: `${resource.type}:${resource.id}`,
                label: `[${resource.type}] ${resource.id}`,
            };
        }));
    }, []);

    const handleCreate = useCallback(async () => {
        if (selectedUsers.length === 0 || resources.length === 0 || reason.trim() === '') {
            setError(formatMessage(messages.saveError));
            return;
        }

        setSaving(true);
        setError(null);
        try {
            await Client4.createAccessControlBypasses({
                subjects: selectedUsers.map((id) => ({type: 'user', id})),
                resources,
                actions: ['membership'],
                expires_at: Date.now() + (Number(durationMinutes.value) * 60 * 1000),
                reason: reason.trim(),
                invite_mode: inviteMode.value as 'none' | 'prompt',
            });
            setSelectedUsers([]);
            setResourceOptions([]);
            setReason('');
            await loadBypasses();
        } catch {
            setError(formatMessage(messages.saveError));
        } finally {
            setSaving(false);
        }
    }, [durationMinutes.value, formatMessage, inviteMode.value, loadBypasses, reason, resources, selectedUsers]);

    const handleRevoke = useCallback(async (id: string) => {
        setError(null);
        try {
            await Client4.revokeAccessControlBypass(id);
            await loadBypasses();
        } catch {
            setError(formatMessage(messages.revokeError));
        }
    }, [formatMessage, loadBypasses]);

    return (
        <div className='AccessControlBypasses'>
            <h3><FormattedMessage {...messages.title}/></h3>
            <p><FormattedMessage {...messages.description}/></p>
            {error && <FormError error={error}/>}
            <div className='form-group'>
                <label><FormattedMessage {...messages.users}/></label>
                <UserSelector
                    id='abac_bypass_users'
                    isMulti={true}
                    multiSelectInitialValue={selectedUsers}
                    multiSelectOnChange={setSelectedUsers}
                />
            </div>
            <div className='form-group'>
                <label><FormattedMessage {...messages.resources}/></label>
                <CreatableSelect<Option, true>
                    inputId='abac_bypass_resources'
                    classNamePrefix='react-select'
                    isMulti={true}
                    value={resourceOptions}
                    onChange={handleResourceChange}
                    placeholder='team:<id> or channel:<id>'
                    noOptionsMessage={() => formatMessage(messages.resourcesHelp)}
                    formatCreateLabel={(value) => value}
                />
                <p className='help-text'><FormattedMessage {...messages.resourcesHelp}/></p>
            </div>
            <div className='form-group'>
                <label><FormattedMessage {...messages.duration}/></label>
                <ReactSelect<Option, false>
                    inputId='abac_bypass_duration'
                    classNamePrefix='react-select'
                    isClearable={false}
                    isSearchable={false}
                    options={durationOptions}
                    value={durationMinutes}
                    onChange={(value) => value && setDurationMinutes(value)}
                />
            </div>
            <div className='form-group'>
                <label><FormattedMessage {...messages.inviteMode}/></label>
                <ReactSelect<Option, false>
                    inputId='abac_bypass_invite_mode'
                    classNamePrefix='react-select'
                    isClearable={false}
                    isSearchable={false}
                    options={inviteModeOptions}
                    value={inviteMode}
                    onChange={(value) => value && setInviteMode(value)}
                />
            </div>
            <div className='form-group'>
                <label htmlFor='abac_bypass_reason'><FormattedMessage {...messages.reason}/></label>
                <textarea
                    id='abac_bypass_reason'
                    className='form-control'
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={1024}
                    rows={3}
                />
            </div>
            <SaveButton
                saving={saving}
                disabled={saving}
                extraClasses='btn-primary'
                defaultMessage={formatMessage(messages.create)}
                savingMessage={formatMessage({id: 'admin.access_control_bypasses.saving', defaultMessage: 'Creating...'})}
                onClick={handleCreate}
            />
            <hr/>
            {loading ? (
                <LoadingScreen/>
            ) : bypasses.length === 0 ? (
                <p><FormattedMessage {...messages.noBypasses}/></p>
            ) : (
                <table className='table'>
                    <thead>
                        <tr>
                            <th>Subject</th>
                            <th>Resource</th>
                            <th>Expires</th>
                            <th>Reason</th>
                            <th/>
                        </tr>
                    </thead>
                    <tbody>
                        {bypasses.map((bypass) => (
                            <tr key={bypass.id}>
                                <td>{bypass.subject_type}:{bypass.subject_id}</td>
                                <td>{bypass.resource_type}:{bypass.resource_id}</td>
                                <td>{formatTimestamp(bypass.expires_at)}</td>
                                <td>{bypass.reason}</td>
                                <td>
                                    <button
                                        type='button'
                                        className='btn btn-tertiary'
                                        onClick={() => handleRevoke(bypass.id)}
                                    >
                                        <FormattedMessage {...messages.revoke}/>
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}
