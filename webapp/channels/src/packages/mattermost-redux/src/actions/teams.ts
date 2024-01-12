// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction} from 'redux';
import {batchActions} from 'redux-batched-actions';

import type {ServerError} from '@mattermost/types/errors';
import type {UsersWithGroupsAndCount} from '@mattermost/types/groups';
import type {ProductNotices} from '@mattermost/types/product_notices';
import type {Team, TeamMembership, TeamMemberWithError, GetTeamMembersOpts, TeamsWithCount, TeamSearchOpts, TeamStats, TeamInviteWithError, NotPagedTeamSearchOpts, PagedTeamSearchOpts} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {ChannelTypes, TeamTypes, UserTypes} from 'mattermost-redux/action_types';
import {selectChannel} from 'mattermost-redux/actions/channels';
import {logError} from 'mattermost-redux/actions/errors';
import {bindClientFunc, forceLogoutIfNecessary} from 'mattermost-redux/actions/helpers';
import {loadRolesIfNeeded} from 'mattermost-redux/actions/roles';
import {getProfilesByIds, getStatusesByIds} from 'mattermost-redux/actions/users';
import {Client4} from 'mattermost-redux/client';
import {General} from 'mattermost-redux/constants';
import {getIsUserStatusesConfigEnabled} from 'mattermost-redux/selectors/entities/common';
import {isCompatibleWithJoinViewTeamPermissions} from 'mattermost-redux/selectors/entities/general';
import {isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import type {GetStateFunc, DispatchFunc, ActionFunc, ActionResult, NewActionFuncAsync} from 'mattermost-redux/types/actions';
import EventEmitter from 'mattermost-redux/utils/event_emitter';

async function getProfilesAndStatusesForMembers(userIds: string[], dispatch: DispatchFunc, getState: GetStateFunc) {
    const state = getState();
    const {
        currentUserId,
        profiles,
        statuses,
    } = state.entities.users;
    const enabledUserStatuses = getIsUserStatusesConfigEnabled(state);

    const profilesToLoad: string[] = [];
    const statusesToLoad: string[] = [];
    userIds.forEach((userId) => {
        if (!profiles[userId] && !profilesToLoad.includes(userId) && userId !== currentUserId) {
            profilesToLoad.push(userId);
        }

        if (!statuses[userId] && !statusesToLoad.includes(userId) && userId !== currentUserId) {
            statusesToLoad.push(userId);
        }
    });
    const requests: Array<Promise<ActionResult|ActionResult[]>> = [];

    if (profilesToLoad.length) {
        requests.push(dispatch(getProfilesByIds(profilesToLoad)));
    }

    if (statusesToLoad.length && enabledUserStatuses) {
        requests.push(dispatch(getStatusesByIds(statusesToLoad)));
    }

    await Promise.all(requests);
}

export function selectTeam(team: Team | Team['id']) {
    const teamId = (typeof team === 'string') ? team : team.id;
    return {
        type: TeamTypes.SELECT_TEAM,
        data: teamId,
    };
}

export function getMyTeams(): ActionFunc {
    return bindClientFunc({
        clientFunc: Client4.getMyTeams,
        onRequest: TeamTypes.MY_TEAMS_REQUEST,
        onSuccess: [TeamTypes.RECEIVED_TEAMS_LIST, TeamTypes.MY_TEAMS_SUCCESS],
        onFailure: TeamTypes.MY_TEAMS_FAILURE,
    });
}

// The argument skipCurrentTeam is a (not ideal) workaround for CRT mention counts. Unread mentions are stored in the reducer per
// team but we do not track unread mentions for DMs/GMs independently. This results in a bit of funky logic and edge case bugs
// that need workarounds like this. In the future we should fix the root cause with better APIs and redux state.
export function getMyTeamUnreads(collapsedThreads: boolean, skipCurrentTeam = false): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        let unreads;
        try {
            unreads = await Client4.getMyTeamUnreads(collapsedThreads);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        if (skipCurrentTeam) {
            const currentTeamId = getCurrentTeamId(getState());
            if (currentTeamId) {
                const index = unreads.findIndex((member) => member.team_id === currentTeamId);
                if (index >= 0) {
                    unreads.splice(index, 1);
                }
            }
        }

        dispatch(
            {
                type: TeamTypes.RECEIVED_MY_TEAM_UNREADS,
                data: unreads,
            },
        );

        return {data: unreads};
    };
}

export function getTeam(teamId: string): NewActionFuncAsync<Team> {
    return bindClientFunc({
        clientFunc: Client4.getTeam,
        onSuccess: TeamTypes.RECEIVED_TEAM,
        params: [
            teamId,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function getTeamByName(teamName: string): ActionFunc<Team, ServerError> {
    return bindClientFunc({
        clientFunc: Client4.getTeamByName,
        onSuccess: TeamTypes.RECEIVED_TEAM,
        params: [
            teamName,
        ],
    });
}

export function getTeams(page = 0, perPage: number = General.TEAMS_CHUNK_SIZE, includeTotalCount = false, excludePolicyConstrained = false): NewActionFuncAsync {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        let data;

        dispatch({type: TeamTypes.GET_TEAMS_REQUEST, data});

        try {
            data = await Client4.getTeams(page, perPage, includeTotalCount, excludePolicyConstrained);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch({type: TeamTypes.GET_TEAMS_FAILURE, data});
            dispatch(logError(error));
            return {error};
        }

        const actions: AnyAction[] = [
            {
                type: TeamTypes.RECEIVED_TEAMS_LIST,
                data: includeTotalCount ? (data as unknown as TeamsWithCount).teams : data,
            },
            {
                type: TeamTypes.GET_TEAMS_SUCCESS,
                data,
            },
        ];

        if (includeTotalCount) {
            actions.push({
                type: TeamTypes.RECEIVED_TOTAL_TEAM_COUNT,
                data: (data as unknown as TeamsWithCount).total_count,
            });
        }

        dispatch(batchActions(actions));

        return {data};
    };
}

export function searchTeams(term: string, opts: PagedTeamSearchOpts): NewActionFuncAsync<Team[]>;
export function searchTeams(term: string, opts?: NotPagedTeamSearchOpts): NewActionFuncAsync<TeamsWithCount>;
export function searchTeams(term: string, opts: TeamSearchOpts = {}): NewActionFuncAsync {
    return async (dispatch, getState) => {
        dispatch({type: TeamTypes.GET_TEAMS_REQUEST, data: null});

        let response;
        try {
            response = await Client4.searchTeams(term, opts);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch({type: TeamTypes.GET_TEAMS_FAILURE, error});
            dispatch(logError(error));
            return {error};
        }

        // The type of the response is determined by whether or not page/perPage were set
        let teams;
        if (!(opts as PagedTeamSearchOpts).page || !(opts as PagedTeamSearchOpts).per_page) {
            teams = response;
        } else {
            teams = response.teams;
        }

        dispatch(batchActions([
            {
                type: TeamTypes.RECEIVED_TEAMS_LIST,
                data: teams,
            },
            {
                type: TeamTypes.GET_TEAMS_SUCCESS,
            },
        ]));

        return {data: response};
    };
}

export function createTeam(team: Team): NewActionFuncAsync<Team> {
    return async (dispatch, getState) => {
        let created;
        try {
            created = await Client4.createTeam(team);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        const member = {
            team_id: created.id,
            user_id: getState().entities.users.currentUserId,
            roles: `${General.TEAM_ADMIN_ROLE} ${General.TEAM_USER_ROLE}`,
            delete_at: 0,
            msg_count: 0,
            mention_count: 0,
        };

        dispatch(batchActions([
            {
                type: TeamTypes.CREATED_TEAM,
                data: created,
            },
            {
                type: TeamTypes.RECEIVED_MY_TEAM_MEMBER,
                data: member,
            },
            {
                type: TeamTypes.SELECT_TEAM,
                data: created.id,
            },
        ]));
        dispatch(loadRolesIfNeeded(member.roles.split(' ')));

        return {data: created};
    };
}

export function deleteTeam(teamId: string): NewActionFuncAsync {
    return async (dispatch, getState) => {
        try {
            await Client4.deleteTeam(teamId);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        const entities = getState().entities;
        const {
            currentTeamId,
        } = entities.teams;
        const actions: AnyAction[] = [];
        if (teamId === currentTeamId) {
            EventEmitter.emit('leave_team');
            actions.push({type: ChannelTypes.SELECT_CHANNEL, data: ''});
        }

        actions.push(
            {
                type: TeamTypes.RECEIVED_TEAM_DELETED,
                data: {id: teamId},
            },
        );

        dispatch(batchActions(actions));

        return {data: true};
    };
}

export function unarchiveTeam(teamId: string): NewActionFuncAsync {
    return async (dispatch, getState) => {
        let team: Team;
        try {
            team = await Client4.unarchiveTeam(teamId);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        dispatch({
            type: TeamTypes.RECEIVED_TEAM_UNARCHIVED,
            data: team,
        });

        return {data: true};
    };
}

export function updateTeam(team: Team): NewActionFuncAsync<Team> {
    return bindClientFunc({
        clientFunc: Client4.updateTeam,
        onSuccess: TeamTypes.UPDATED_TEAM,
        params: [
            team,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function patchTeam(team: Partial<Team> & {id: string}): NewActionFuncAsync<Team> {
    return bindClientFunc({
        clientFunc: Client4.patchTeam,
        onSuccess: TeamTypes.PATCHED_TEAM,
        params: [
            team,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function regenerateTeamInviteId(teamId: string): NewActionFuncAsync<Team> {
    return bindClientFunc({
        clientFunc: Client4.regenerateTeamInviteId,
        onSuccess: TeamTypes.REGENERATED_TEAM_INVITE_ID,
        params: [
            teamId,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function getMyTeamMembers(): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const getMyTeamMembersFunc = bindClientFunc({
            clientFunc: Client4.getMyTeamMembers,
            onSuccess: TeamTypes.RECEIVED_MY_TEAM_MEMBERS,
        });
        const teamMembers = (await getMyTeamMembersFunc(dispatch, getState)) as ActionResult;

        if ('data' in teamMembers && teamMembers.data) {
            const roles = new Set<string>();

            for (const teamMember of teamMembers.data) {
                for (const role of teamMember.roles.split(' ')) {
                    roles.add(role);
                }
            }
            if (roles.size > 0) {
                dispatch(loadRolesIfNeeded([...roles]));
            }
        }

        return teamMembers;
    };
}

export function getTeamMembers(teamId: string, page = 0, perPage: number = General.TEAMS_CHUNK_SIZE, options?: GetTeamMembersOpts): NewActionFuncAsync<TeamMembership[]> {
    return bindClientFunc({
        clientFunc: Client4.getTeamMembers,
        onRequest: TeamTypes.GET_TEAM_MEMBERS_REQUEST,
        onSuccess: [TeamTypes.RECEIVED_MEMBERS_IN_TEAM, TeamTypes.GET_TEAM_MEMBERS_SUCCESS],
        onFailure: TeamTypes.GET_TEAM_MEMBERS_FAILURE,
        params: [
            teamId,
            page,
            perPage,
            options,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function getTeamMember(teamId: string, userId: string): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        let member;
        try {
            const memberRequest = Client4.getTeamMember(teamId, userId);

            getProfilesAndStatusesForMembers([userId], dispatch, getState);

            member = await memberRequest;
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        dispatch({
            type: TeamTypes.RECEIVED_MEMBERS_IN_TEAM,
            data: [member],
        });

        return {data: member};
    };
}

export function getTeamMembersByIds(teamId: string, userIds: string[]): NewActionFuncAsync<TeamMembership[]> {
    return async (dispatch, getState) => {
        let members;
        try {
            const membersRequest = Client4.getTeamMembersByIds(teamId, userIds);

            getProfilesAndStatusesForMembers(userIds, dispatch, getState);

            members = await membersRequest;
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        dispatch({
            type: TeamTypes.RECEIVED_MEMBERS_IN_TEAM,
            data: members,
        });

        return {data: members};
    };
}

export function getTeamsForUser(userId: string): NewActionFuncAsync<Team[]> {
    return bindClientFunc({
        clientFunc: Client4.getTeamsForUser,
        onRequest: TeamTypes.GET_TEAMS_REQUEST,
        onSuccess: [TeamTypes.RECEIVED_TEAMS_LIST, TeamTypes.GET_TEAMS_SUCCESS],
        onFailure: TeamTypes.GET_TEAMS_FAILURE,
        params: [
            userId,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function getTeamMembersForUser(userId: string): NewActionFuncAsync<TeamMembership[]> {
    return bindClientFunc({
        clientFunc: Client4.getTeamMembersForUser,
        onSuccess: TeamTypes.RECEIVED_TEAM_MEMBERS,
        params: [
            userId,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function getTeamStats(teamId: string): NewActionFuncAsync<TeamStats> {
    return bindClientFunc({
        clientFunc: Client4.getTeamStats,
        onSuccess: TeamTypes.RECEIVED_TEAM_STATS,
        params: [
            teamId,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function addUserToTeamFromInvite(token: string, inviteId: string): NewActionFuncAsync<TeamMembership> {
    return bindClientFunc({
        clientFunc: Client4.addToTeamFromInvite,
        onRequest: TeamTypes.ADD_TO_TEAM_FROM_INVITE_REQUEST,
        onSuccess: TeamTypes.ADD_TO_TEAM_FROM_INVITE_SUCCESS,
        onFailure: TeamTypes.ADD_TO_TEAM_FROM_INVITE_FAILURE,
        params: [
            token,
            inviteId,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function addUserToTeam(teamId: string, userId: string): NewActionFuncAsync<TeamMembership> {
    return async (dispatch, getState) => {
        let member;
        try {
            member = await Client4.addToTeam(teamId, userId);
        } catch (error) {
            forceLogoutIfNecessary(error as ServerError, dispatch, getState);
            dispatch(logError(error as ServerError));
            return {error: error as ServerError};
        }

        dispatch(batchActions([
            {
                type: UserTypes.RECEIVED_PROFILE_IN_TEAM,
                data: {id: teamId, user_id: userId},
            },
            {
                type: TeamTypes.RECEIVED_MEMBER_IN_TEAM,
                data: member,
            },
        ]));

        return {data: member};
    };
}

export function addUsersToTeam(teamId: string, userIds: string[]): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        let members;
        try {
            members = await Client4.addUsersToTeam(teamId, userIds);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        const profiles: Array<Partial<UserProfile>> = [];
        members.forEach((m: TeamMembership) => profiles.push({id: m.user_id}));

        dispatch(batchActions([
            {
                type: UserTypes.RECEIVED_PROFILES_LIST_IN_TEAM,
                data: profiles,
                id: teamId,
            },
            {
                type: TeamTypes.RECEIVED_MEMBERS_IN_TEAM,
                data: members,
            },
        ]));

        return {data: members};
    };
}

export function addUsersToTeamGracefully(teamId: string, userIds: string[]): NewActionFuncAsync<TeamMemberWithError[]> {
    return async (dispatch, getState) => {
        let result: TeamMemberWithError[];
        try {
            result = await Client4.addUsersToTeamGracefully(teamId, userIds);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        const addedMembers = result ? result.filter((m) => !m.error) : [];
        const profiles: Array<Partial<UserProfile>> = addedMembers.map((m) => ({id: m.user_id}));
        const members = addedMembers.map((m) => m.member);
        dispatch(batchActions([
            {
                type: UserTypes.RECEIVED_PROFILES_LIST_IN_TEAM,
                data: profiles,
                id: teamId,
            },
            {
                type: TeamTypes.RECEIVED_MEMBERS_IN_TEAM,
                data: members,
            },
        ]));

        return {data: result};
    };
}

export function removeUserFromTeam(teamId: string, userId: string): NewActionFuncAsync {
    return async (dispatch, getState) => {
        try {
            await Client4.removeFromTeam(teamId, userId);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        const member = {
            team_id: teamId,
            user_id: userId,
        };

        const actions: AnyAction[] = [
            {
                type: UserTypes.RECEIVED_PROFILE_NOT_IN_TEAM,
                data: {id: teamId, user_id: userId},
            },
            {
                type: TeamTypes.REMOVE_MEMBER_FROM_TEAM,
                data: member,
            },
        ];

        const state = getState();
        const currentUserId = getCurrentUserId(state);

        if (userId === currentUserId) {
            const {channels, myMembers} = state.entities.channels;

            for (const channelMember of Object.values(myMembers)) {
                const channel = channels[channelMember.channel_id];

                if (channel && channel.team_id === teamId) {
                    actions.push({
                        type: ChannelTypes.LEAVE_CHANNEL,
                        data: channel,
                    });
                }
            }

            if (teamId === getCurrentTeamId(state)) {
                actions.push(selectChannel(''));
            }
        }

        dispatch(batchActions(actions));

        return {data: true};
    };
}

export function updateTeamMemberRoles(teamId: string, userId: string, roles: string[]): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        try {
            await Client4.updateTeamMemberRoles(teamId, userId, roles);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        const membersInTeam = getState().entities.teams.membersInTeam[teamId];
        if (membersInTeam && membersInTeam[userId]) {
            dispatch({
                type: TeamTypes.RECEIVED_MEMBER_IN_TEAM,
                data: {...membersInTeam[userId], roles},
            });
        }

        return {data: true};
    };
}

export function sendEmailInvitesToTeam(teamId: string, emails: string[]): ActionFunc {
    return bindClientFunc({
        clientFunc: Client4.sendEmailInvitesToTeam,
        params: [
            teamId,
            emails,
        ],
    });
}

export function sendEmailGuestInvitesToChannels(teamId: string, channelIds: string[], emails: string[], message: string): ActionFunc {
    return bindClientFunc({
        clientFunc: Client4.sendEmailGuestInvitesToChannels,
        params: [
            teamId,
            channelIds,
            emails,
            message,
        ],
    });
}
export function sendEmailInvitesToTeamGracefully(teamId: string, emails: string[]): NewActionFuncAsync<TeamInviteWithError[]> {
    return bindClientFunc({
        clientFunc: Client4.sendEmailInvitesToTeamGracefully,
        params: [
            teamId,
            emails,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function sendEmailGuestInvitesToChannelsGracefully(teamId: string, channelIds: string[], emails: string[], message: string): ActionFunc {
    return bindClientFunc({
        clientFunc: Client4.sendEmailGuestInvitesToChannelsGracefully,
        params: [
            teamId,
            channelIds,
            emails,
            message,
        ],
    });
}

export function sendEmailInvitesToTeamAndChannelsGracefully(
    teamId: string,
    channelIds: string[],
    emails: string[],
    message: string,
): NewActionFuncAsync<TeamInviteWithError[]> {
    return bindClientFunc({
        clientFunc: Client4.sendEmailInvitesToTeamAndChannelsGracefully,
        params: [
            teamId,
            channelIds,
            emails,
            message,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function getTeamInviteInfo(inviteId: string): ActionFunc {
    return bindClientFunc({
        clientFunc: Client4.getTeamInviteInfo,
        onRequest: TeamTypes.TEAM_INVITE_INFO_REQUEST,
        onSuccess: TeamTypes.TEAM_INVITE_INFO_SUCCESS,
        onFailure: TeamTypes.TEAM_INVITE_INFO_FAILURE,
        params: [
            inviteId,
        ],
    });
}

export function checkIfTeamExists(teamName: string): NewActionFuncAsync<boolean> {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.checkIfTeamExists(teamName);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        return {data: data.exists};
    };
}

export function joinTeam(inviteId: string, teamId: string): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        dispatch({type: TeamTypes.JOIN_TEAM_REQUEST, data: null});

        const state = getState();
        try {
            if (isCompatibleWithJoinViewTeamPermissions(state)) {
                const currentUserId = state.entities.users.currentUserId;
                await Client4.addToTeam(teamId, currentUserId);
            } else {
                await Client4.joinTeam(inviteId);
            }
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch({type: TeamTypes.JOIN_TEAM_FAILURE, error});
            dispatch(logError(error));
            return {error};
        }

        dispatch(getMyTeamUnreads(isCollapsedThreadsEnabled(state)));

        await Promise.all([
            dispatch(getTeam(teamId)),
            dispatch(getMyTeamMembers()),
        ]);

        dispatch({type: TeamTypes.JOIN_TEAM_SUCCESS, data: null});
        return {data: true};
    };
}

export function setTeamIcon(teamId: string, imageData: File): NewActionFuncAsync {
    return async (dispatch) => {
        await Client4.setTeamIcon(teamId, imageData);
        const team = await Client4.getTeam(teamId);
        dispatch({
            type: TeamTypes.PATCHED_TEAM,
            data: team,
        });
        return {data: {status: 'OK'}};
    };
}

export function removeTeamIcon(teamId: string): NewActionFuncAsync {
    return async (dispatch) => {
        await Client4.removeTeamIcon(teamId);
        const team = await Client4.getTeam(teamId);
        dispatch({
            type: TeamTypes.PATCHED_TEAM,
            data: team,
        });
        return {data: {status: 'OK'}};
    };
}

export function updateTeamScheme(teamId: string, schemeId: string): NewActionFuncAsync<{teamId: string; schemeId: string}> {
    return bindClientFunc({
        clientFunc: async () => {
            await Client4.updateTeamScheme(teamId, schemeId);
            return {teamId, schemeId};
        },
        onSuccess: TeamTypes.UPDATED_TEAM_SCHEME,
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function updateTeamMemberSchemeRoles(
    teamId: string,
    userId: string,
    isSchemeUser: boolean,
    isSchemeAdmin: boolean,
): NewActionFuncAsync {
    return bindClientFunc({
        clientFunc: async () => {
            await Client4.updateTeamMemberSchemeRoles(teamId, userId, isSchemeUser, isSchemeAdmin);
            return {teamId, userId, isSchemeUser, isSchemeAdmin};
        },
        onSuccess: TeamTypes.UPDATED_TEAM_MEMBER_SCHEME_ROLES,
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function invalidateAllEmailInvites(): ActionFunc {
    return bindClientFunc({
        clientFunc: Client4.invalidateAllEmailInvites,
    });
}

export function membersMinusGroupMembers(teamID: string, groupIDs: string[], page = 0, perPage: number = General.PROFILE_CHUNK_SIZE): NewActionFuncAsync<UsersWithGroupsAndCount> {
    return bindClientFunc({
        clientFunc: Client4.teamMembersMinusGroupMembers,
        onSuccess: TeamTypes.RECEIVED_TEAM_MEMBERS_MINUS_GROUP_MEMBERS,
        params: [
            teamID,
            groupIDs,
            page,
            perPage,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function getInProductNotices(teamId: string, client: string, clientVersion: string): NewActionFuncAsync<ProductNotices> {
    return bindClientFunc({
        clientFunc: Client4.getInProductNotices,
        params: [
            teamId,
            client,
            clientVersion,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function updateNoticesAsViewed(noticeIds: string[]): ActionFunc {
    return bindClientFunc({
        clientFunc: Client4.updateNoticesAsViewed,
        params: [
            noticeIds,
        ],
    });
}
