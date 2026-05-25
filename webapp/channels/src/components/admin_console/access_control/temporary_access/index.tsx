// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {FormattedMessage, defineMessages, useIntl} from 'react-intl';
import type {MultiValue} from 'react-select';
import ReactSelect from 'react-select';
import AsyncSelect from 'react-select/async';

import {Button} from '@mattermost/shared/components/button';
import type {AccessControlTemporaryAccess, AccessControlTemporaryAccessCreateRequest, AccessControlTemporaryAccessResource, AccessControlTemporaryAccessSearch} from '@mattermost/types/access_control';
import type {Channel, ChannelWithTeamData, ChannelsWithTotalCount} from '@mattermost/types/channels';
import type {Team, TeamsWithCount} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';

import type {Column, Row} from 'components/admin_console/data_grid/data_grid';
import DataGrid from 'components/admin_console/data_grid/data_grid';
import JobsTable from 'components/admin_console/jobs';
import FormError from 'components/form_error';
import SaveButton from 'components/save_button';
import AdminHeader from 'components/widgets/admin_console/admin_header';
import {getHistory} from 'utils/browser_history';
import {JobTypes} from 'utils/constants';

import {UserSelector} from '../../content_flagging/user_multiselector/user_multiselector';

import './temporary_access.scss';

type Option = {
    value: string;
    label: string;
}

type ResourceType = 'team' | 'channel';

type ResourceOption = Option & {
    resource: AccessControlTemporaryAccessResource;
}

type Props = {
    createOnly?: boolean;
}

const PAGE_SIZE = 10;

const messages = defineMessages({
    title: {id: 'admin.access_control_temporary_access.title', defaultMessage: 'Temporary Access'},
    description: {id: 'admin.access_control_temporary_access.description', defaultMessage: 'Grant users temporary access to teams or channels restricted by attribute-based access controls.'},
    createTitle: {id: 'admin.access_control_temporary_access.createTitle', defaultMessage: 'Create temporary access'},
    createDescription: {id: 'admin.access_control_temporary_access.createDescription', defaultMessage: 'Select users, resources, duration, and the reason for this temporary exception.'},
    users: {id: 'admin.access_control_temporary_access.users', defaultMessage: 'Users'},
    resourceType: {id: 'admin.access_control_temporary_access.resourceType', defaultMessage: 'Resource type'},
    resources: {id: 'admin.access_control_temporary_access.resources', defaultMessage: 'Resources'},
    resourcesHelp: {id: 'admin.access_control_temporary_access.resourcesHelp', defaultMessage: 'Search and select the teams or channels this temporary access should apply to.'},
    duration: {id: 'admin.access_control_temporary_access.duration', defaultMessage: 'Duration'},
    reason: {id: 'admin.access_control_temporary_access.reason', defaultMessage: 'Reason'},
    inviteMode: {id: 'admin.access_control_temporary_access.inviteMode', defaultMessage: 'Invite behavior'},
    create: {id: 'admin.access_control_temporary_access.create', defaultMessage: 'Create temporary access'},
    cancel: {id: 'admin.access_control_temporary_access.cancel', defaultMessage: 'Cancel'},
    revoke: {id: 'admin.access_control_temporary_access.revoke', defaultMessage: 'Revoke'},
    noTemporaryAccesses: {id: 'admin.access_control_temporary_access.noTemporaryAccesses', defaultMessage: 'No temporary access grants found.'},
    noTemporaryAccessesHint: {id: 'admin.access_control_temporary_access.noTemporaryAccessesHint', defaultMessage: 'Create temporary access to grant users time-limited access.'},
    noSearchResults: {id: 'admin.access_control_temporary_access.noSearchResults', defaultMessage: 'No temporary access grants match your search.'},
    saveError: {id: 'admin.access_control_temporary_access.saveError', defaultMessage: 'Unable to save the temporary access. Check the selected users, resources, duration, and reason.'},
    loadError: {id: 'admin.access_control_temporary_access.loadError', defaultMessage: 'Unable to load active temporary access grants.'},
    revokeError: {id: 'admin.access_control_temporary_access.revokeError', defaultMessage: 'Unable to revoke the temporary access.'},
    jobRunsTitle: {id: 'admin.access_control_temporary_access.jobRunsTitle', defaultMessage: 'Temporary access expiration job runs'},
    jobRunsDescription: {id: 'admin.access_control_temporary_access.jobRunsDescription', defaultMessage: 'Recent scheduled runs that expire temporary access and remove memberships created only for temporary access.'},
    showInactiveTemporaryAccesses: {id: 'admin.access_control_temporary_access.showInactiveTemporaryAccesses', defaultMessage: 'Show inactive temporary access'},
    showInactiveJobRuns: {id: 'admin.access_control_temporary_access.showInactiveJobRuns', defaultMessage: 'Show inactive job runs'},
});

const durationOptions = [
    {value: '2', label: '2 minutes'},
    {value: '5', label: '5 minutes'},
    {value: '15', label: '15 minutes'},
    {value: '60', label: '1 hour'},
    {value: '240', label: '4 hours'},
    {value: '1440', label: '1 day'},
    {value: '10080', label: '7 days'},
];

const inviteModeOptions = [
    {value: 'prompt', label: 'Notify user'},
    {value: 'none', label: 'No notification'},
];

const resourceTypeOptions: Array<Option & {value: ResourceType}> = [
    {value: 'channel', label: 'Channels'},
    {value: 'team', label: 'Teams'},
];

function formatTimestamp(timestamp: number): string {
    if (!timestamp) {
        return '';
    }
    return new Date(timestamp).toLocaleString();
}

function searchAccessControlTemporaryAccesses(opts: AccessControlTemporaryAccessSearch) {
    return Client4.searchAccessControlTemporaryAccesses(opts);
}

function createAccessControlTemporaryAccesses(request: AccessControlTemporaryAccessCreateRequest) {
    return Client4.createAccessControlTemporaryAccesses(request);
}

function revokeAccessControlTemporaryAccess(id: string) {
    return Client4.revokeAccessControlTemporaryAccess(id);
}

function getErrorMessage(error: unknown, fallback: string): string {
    if (error && typeof error === 'object') {
        const maybeError = error as {message?: string; server_error_id?: string; id?: string};
        return maybeError.message || maybeError.server_error_id || maybeError.id || fallback;
    }
    return fallback;
}

function formatUserLabel(user?: UserProfile): string {
    if (!user) {
        return '';
    }
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    return fullName ? `${fullName} (@${user.username})` : `@${user.username}`;
}

function formatTeamLabel(team?: Team): string {
    return team ? (team.display_name || team.name || team.id) : '';
}

function formatChannelLabel(channel?: Channel): string {
    return channel ? (channel.display_name || channel.name || channel.id) : '';
}

function isTemporaryAccessActive(temporaryAccess: AccessControlTemporaryAccess): boolean {
    return temporaryAccess.delete_at === 0 && temporaryAccess.expires_at > Date.now();
}

export function AccessControlTemporaryAccessCreatePage() {
    return <AccessControlTemporaryAccesses createOnly={true}/>;
}

export default function AccessControlTemporaryAccesses({createOnly = false}: Props) {
    const {formatMessage} = useIntl();
    const history = useMemo(() => getHistory(), []);
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [resourceType, setResourceType] = useState<Option & {value: ResourceType}>(resourceTypeOptions[0]);
    const [resourceOptions, setResourceOptions] = useState<ResourceOption[]>([]);
    const [durationMinutes, setDurationMinutes] = useState<Option>(durationOptions[0]);
    const [inviteMode, setInviteMode] = useState<Option>(inviteModeOptions[0]);
    const [reason, setReason] = useState('');
    const [temporaryAccesses, setTemporaryAccesses] = useState<AccessControlTemporaryAccess[]>([]);
    const [subjectLabels, setSubjectLabels] = useState<Record<string, string>>({});
    const [resourceLabels, setResourceLabels] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showInactiveTemporaryAccesses, setShowInactiveTemporaryAccesses] = useState(false);
    const [showInactiveJobRuns, setShowInactiveJobRuns] = useState(false);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(0);

    const selectedUserIds = selectedUsers ?? [];
    const selectedResourceOptions = resourceOptions ?? [];
    const activeTemporaryAccesses = temporaryAccesses ?? [];
    const resources = useMemo(() => selectedResourceOptions.map((option) => option.resource), [selectedResourceOptions]);

    const loadTemporaryAccesses = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await searchAccessControlTemporaryAccesses({status: showInactiveTemporaryAccesses ? undefined : 'active', page: 0, per_page: 200});
            setTemporaryAccesses(Array.isArray(result?.temporary_accesses) ? result.temporary_accesses : []);
        } catch (err) {
            setError(getErrorMessage(err, formatMessage(messages.loadError)));
        } finally {
            setLoading(false);
        }
    }, [formatMessage, showInactiveTemporaryAccesses]);

    useEffect(() => {
        loadTemporaryAccesses();
    }, [loadTemporaryAccesses]);

    useEffect(() => {
        let cancelled = false;

        async function loadTemporaryAccessLabels() {
            const userIds = [...new Set(activeTemporaryAccesses.filter((temporaryAccess) => temporaryAccess.subject_type === 'user').map((temporaryAccess) => temporaryAccess.subject_id))];
            const teamIds = [...new Set(activeTemporaryAccesses.filter((temporaryAccess) => temporaryAccess.resource_type === 'team').map((temporaryAccess) => temporaryAccess.resource_id))];
            const channelIds = [...new Set(activeTemporaryAccesses.filter((temporaryAccess) => temporaryAccess.resource_type === 'channel').map((temporaryAccess) => temporaryAccess.resource_id))];

            const users = userIds.length > 0 ? await Client4.getProfilesByIds(userIds).catch(() => [] as UserProfile[]) : [];
            const teamResults = await Promise.allSettled(teamIds.map((id) => Client4.getTeam(id)));
            const channelResults = await Promise.allSettled(channelIds.map((id) => Client4.getChannel(id)));

            if (cancelled) {
                return;
            }

            const nextSubjectLabels: Record<string, string> = {};
            users.forEach((user) => {
                nextSubjectLabels[user.id] = formatUserLabel(user);
            });

            const nextResourceLabels: Record<string, string> = {};
            teamResults.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    nextResourceLabels[`team:${teamIds[index]}`] = formatTeamLabel(result.value);
                }
            });
            channelResults.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    nextResourceLabels[`channel:${channelIds[index]}`] = formatChannelLabel(result.value);
                }
            });

            setSubjectLabels(nextSubjectLabels);
            setResourceLabels(nextResourceLabels);
        }

        loadTemporaryAccessLabels();

        return () => {
            cancelled = true;
        };
    }, [activeTemporaryAccesses]);

    const loadResourceOptions = useCallback(async (inputValue: string): Promise<ResourceOption[]> => {
        if (resourceType.value === 'team') {
            const result = await Client4.searchTeams(inputValue, {page: 0, per_page: 20});
            const teams = Array.isArray(result) ? result : (result as TeamsWithCount).teams;
            return teams.map((team: Team) => ({
                value: team.id,
                label: team.display_name || team.name,
                resource: {type: 'team', id: team.id},
            }));
        }

        const result = await Client4.searchAllChannels(inputValue, {page: 0, per_page: 20, include_deleted: false});
        const channels = Array.isArray(result) ? result : (result as ChannelsWithTotalCount).channels;
        return channels.map((channel: ChannelWithTeamData) => ({
            value: channel.id,
            label: `${channel.display_name || channel.name}${channel.team_display_name ? ` (${channel.team_display_name})` : ''}`,
            resource: {type: 'channel', id: channel.id},
        }));
    }, [resourceType.value]);

    const handleResourceTypeChange = useCallback((value: (Option & {value: ResourceType}) | null) => {
        if (!value) {
            return;
        }
        setResourceType(value);
        setResourceOptions([]);
    }, []);

    const handleSelectedUsersChange = useCallback((value: string[] | null) => {
        setSelectedUsers(value ?? []);
    }, []);

    const handleResourceChange = useCallback((value: MultiValue<ResourceOption> | null) => {
        setResourceOptions(value ? [...value] : []);
    }, []);

    const handleCreate = useCallback(async () => {
        if (selectedUserIds.length === 0 || resources.length === 0 || reason.trim() === '') {
            setError(formatMessage(messages.saveError));
            return;
        }

        setSaving(true);
        setError(null);
        try {
            await createAccessControlTemporaryAccesses({
                subjects: selectedUserIds.map((id) => ({type: 'user', id})),
                resources,
                actions: ['membership'],
                expires_at: Date.now() + (Number(durationMinutes.value) * 60 * 1000),
                reason: reason.trim(),
                invite_mode: inviteMode.value as 'none' | 'prompt',
            });
            setSelectedUsers([]);
            setResourceOptions([]);
            setReason('');
            if (createOnly) {
                history.push('/admin_console/system_attributes/temporary_access');
                return;
            }
            await loadTemporaryAccesses();
        } catch (err) {
            setError(getErrorMessage(err, formatMessage(messages.saveError)));
        } finally {
            setSaving(false);
        }
    }, [createOnly, durationMinutes.value, formatMessage, history, inviteMode.value, loadTemporaryAccesses, reason, resources, selectedUserIds]);

    const handleRevoke = useCallback(async (id: string) => {
        setError(null);
        try {
            await revokeAccessControlTemporaryAccess(id);
            await loadTemporaryAccesses();
        } catch (err) {
            setError(getErrorMessage(err, formatMessage(messages.revokeError)));
        }
    }, [formatMessage, loadTemporaryAccesses]);

    const getSubjectLabel = useCallback((temporaryAccess: AccessControlTemporaryAccess) => {
        return subjectLabels[temporaryAccess.subject_id] || `${temporaryAccess.subject_type}:${temporaryAccess.subject_id}`;
    }, [subjectLabels]);

    const getResourceLabel = useCallback((temporaryAccess: AccessControlTemporaryAccess) => {
        return resourceLabels[`${temporaryAccess.resource_type}:${temporaryAccess.resource_id}`] || `${temporaryAccess.resource_type}:${temporaryAccess.resource_id}`;
    }, [resourceLabels]);

    const filteredTemporaryAccesses = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) {
            return activeTemporaryAccesses;
        }

        return activeTemporaryAccesses.filter((temporaryAccess) => {
            const searchable = [
                getSubjectLabel(temporaryAccess),
                getResourceLabel(temporaryAccess),
                temporaryAccess.action,
                temporaryAccess.reason,
                temporaryAccess.invite_mode || '',
            ].join(' ').toLowerCase();
            return searchable.includes(term);
        });
    }, [activeTemporaryAccesses, getResourceLabel, getSubjectLabel, search]);

    const pagedTemporaryAccesses = useMemo(() => {
        const start = page * PAGE_SIZE;
        return filteredTemporaryAccesses.slice(start, start + PAGE_SIZE);
    }, [filteredTemporaryAccesses, page]);

    const nextPage = useCallback(() => {
        if ((page + 1) * PAGE_SIZE < filteredTemporaryAccesses.length) {
            setPage(page + 1);
        }
    }, [filteredTemporaryAccesses.length, page]);

    const previousPage = useCallback(() => {
        if (page > 0) {
            setPage(page - 1);
        }
    }, [page]);

    const onSearch = useCallback((term: string) => {
        setSearch(term);
        setPage(0);
    }, []);

    const columns: Column[] = [
        {
            name: <FormattedMessage id='admin.access_control_temporary_access.subject' defaultMessage='User'/>,
            field: 'subject',
            width: 3,
        },
        {
            name: <FormattedMessage id='admin.access_control_temporary_access.resource' defaultMessage='Resource'/>,
            field: 'resource',
            width: 3,
        },
        {
            name: <FormattedMessage id='admin.access_control_temporary_access.expires' defaultMessage='Expires'/>,
            field: 'expires',
            width: 2,
        },
        {
            name: <FormattedMessage id='admin.access_control_temporary_access.reasonColumn' defaultMessage='Reason'/>,
            field: 'reason',
            width: 3,
        },
        {
            name: <span/>,
            field: 'actions',
            className: 'actions-column',
            width: 1,
        },
    ];

    const rows: Row[] = pagedTemporaryAccesses.map((temporaryAccess) => ({
        cells: {
            subject: <span>{getSubjectLabel(temporaryAccess)}</span>,
            resource: <span>{getResourceLabel(temporaryAccess)}</span>,
            expires: <span>{formatTimestamp(temporaryAccess.expires_at)}</span>,
            reason: <span>{temporaryAccess.reason}</span>,
            actions: (
                <div className='AccessControlTemporaryAccesses__actions'>
                    {isTemporaryAccessActive(temporaryAccess) && (
                        <button
                            type='button'
                            className='btn btn-tertiary btn-sm'
                            onClick={() => handleRevoke(temporaryAccess.id)}
                        >
                            <FormattedMessage {...messages.revoke}/>
                        </button>
                    )}
                </div>
            ),
        },
    }));

    const startCount = filteredTemporaryAccesses.length === 0 ? 0 : (page * PAGE_SIZE) + 1;
    const endCount = Math.min(startCount + rows.length - 1, filteredTemporaryAccesses.length);
    const placeholderEmpty = search ? (
        <div className='AccessControlTemporaryAccesses__empty'>
            <FormattedMessage {...messages.noSearchResults}/>
        </div>
    ) : (
        <div className='AccessControlTemporaryAccesses__empty'>
            <FormattedMessage {...messages.noTemporaryAccesses}/>
            <span>
                <FormattedMessage {...messages.noTemporaryAccessesHint}/>
            </span>
        </div>
    );

    const createPanel = (
        <div className='AccessControlTemporaryAccesses__create-panel'>
            <div className='AccessControlTemporaryAccesses__create-header'>
                <h2><FormattedMessage {...messages.createTitle}/></h2>
                <p><FormattedMessage {...messages.createDescription}/></p>
            </div>
            <div className='form-group'>
                <label><FormattedMessage {...messages.users}/></label>
                <UserSelector
                    id='temporary_access_users'
                    isMulti={true}
                    multiSelectInitialValue={selectedUserIds}
                    multiSelectOnChange={handleSelectedUsersChange}
                />
            </div>
            <div className='form-group'>
                <label><FormattedMessage {...messages.resourceType}/></label>
                <ReactSelect<Option & {value: ResourceType}, false>
                    inputId='temporary_access_resource_type'
                    classNamePrefix='react-select'
                    isClearable={false}
                    isSearchable={false}
                    options={resourceTypeOptions}
                    value={resourceType}
                    onChange={handleResourceTypeChange}
                />
            </div>
            <div className='form-group'>
                <label><FormattedMessage {...messages.resources}/></label>
                <AsyncSelect<ResourceOption, true>
                    inputId='temporary_access_resources'
                    classNamePrefix='react-select'
                    isMulti={true}
                    cacheOptions={true}
                    defaultOptions={true}
                    loadOptions={loadResourceOptions}
                    value={selectedResourceOptions}
                    onChange={handleResourceChange}
                    placeholder={formatMessage(messages.resources)}
                    noOptionsMessage={() => formatMessage(messages.resourcesHelp)}
                />
                <p className='help-text'><FormattedMessage {...messages.resourcesHelp}/></p>
            </div>
            <div className='form-group'>
                <label><FormattedMessage {...messages.duration}/></label>
                <ReactSelect<Option, false>
                    inputId='temporary_access_duration'
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
                    inputId='temporary_access_invite_mode'
                    classNamePrefix='react-select'
                    isClearable={false}
                    isSearchable={false}
                    options={inviteModeOptions}
                    value={inviteMode}
                    onChange={(value) => value && setInviteMode(value)}
                />
            </div>
            <div className='form-group'>
                <label htmlFor='temporary_access_reason'><FormattedMessage {...messages.reason}/></label>
                <textarea
                    id='temporary_access_reason'
                    className='form-control'
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={1024}
                    rows={3}
                />
            </div>
            <div className='AccessControlTemporaryAccesses__create-actions'>
                <SaveButton
                    saving={saving}
                    disabled={saving}
                    extraClasses='btn-primary'
                    defaultMessage={formatMessage(messages.create)}
                    savingMessage={formatMessage({id: 'admin.access_control_temporary_access.saving', defaultMessage: 'Creating...'})}
                    onClick={handleCreate}
                />
                <Button
                    emphasis='tertiary'
                    onClick={() => {
                        if (createOnly) {
                            history.push('/admin_console/system_attributes/temporary_access');
                            return;
                        }
                    }}
                >
                    <FormattedMessage {...messages.cancel}/>
                </Button>
            </div>
        </div>
    );

    if (createOnly) {
        return (
            <div className='wrapper--fixed AccessControlTemporaryAccesses'>
                <AdminHeader withBackButton={true}>
                    <div>
                        <a
                            href='/admin_console/system_attributes/temporary_access'
                            className='fa fa-angle-left back'
                            onClick={(e) => {
                                e.preventDefault();
                                history.push('/admin_console/system_attributes/temporary_access');
                            }}
                        />
                        <FormattedMessage {...messages.createTitle}/>
                    </div>
                </AdminHeader>
                <div className='admin-console__wrapper'>
                    <div className='admin-console__content'>
                        <div className='admin-console__setting-group'>
                            {error && <FormError error={error}/>}
                            {createPanel}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className='AccessControlTemporaryAccesses'>
            <div className='policy-header'>
                <div className='policy-header-text'>
                    <h1><FormattedMessage {...messages.title}/></h1>
                    <p><FormattedMessage {...messages.description}/></p>
                </div>
                <Button
                    emphasis='primary'
                    onClick={() => history.push('/admin_console/system_attributes/temporary_access/create')}
                >
                    <i className='icon icon-plus'/>
                    <span><FormattedMessage {...messages.create}/></span>
                </Button>
            </div>
            {error && <FormError error={error}/>}
            <DataGrid
                columns={columns}
                rows={rows}
                loading={loading}
                startCount={startCount}
                endCount={endCount}
                total={filteredTemporaryAccesses.length}
                onSearch={onSearch}
                term={search}
                placeholderEmpty={placeholderEmpty}
                rowsContainerStyles={{minHeight: `${Math.max(rows.length, 1) * 40}px`}}
                nextPage={nextPage}
                previousPage={previousPage}
                extraComponent={(
                    <label className='AccessControlTemporaryAccesses__checkbox'>
                        <input
                            type='checkbox'
                            checked={showInactiveTemporaryAccesses}
                            onChange={(e) => {
                                setShowInactiveTemporaryAccesses(e.target.checked);
                                setPage(0);
                            }}
                        />
                        <FormattedMessage {...messages.showInactiveTemporaryAccesses}/>
                    </label>
                )}
            />
            <div className='AccessControlTemporaryAccesses__jobs'>
                <div className='AccessControlTemporaryAccesses__jobs-header'>
                    <h2><FormattedMessage {...messages.jobRunsTitle}/></h2>
                    <p><FormattedMessage {...messages.jobRunsDescription}/></p>
                </div>
                <label className='AccessControlTemporaryAccesses__checkbox AccessControlTemporaryAccesses__jobs-toggle'>
                    <input
                        type='checkbox'
                        checked={showInactiveJobRuns}
                        onChange={(e) => setShowInactiveJobRuns(e.target.checked)}
                    />
                    <FormattedMessage {...messages.showInactiveJobRuns}/>
                </label>
                <JobsTable
                    perPage={5}
                    jobType={JobTypes.TEMPORARY_ACCESS_EXPIRATION}
                    hideJobCreateButton={true}
                    className='job-table__access-control-temporary-access'
                    createJobButtonText=''
                    disabled={false}
                    createJobHelpText={<></>}
                    showInactiveJobs={showInactiveJobRuns}
                />
            </div>
        </div>
    );
}
