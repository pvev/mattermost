// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

const maxAccessControlTemporaryAccessDuration = 7 * 24 * time.Hour

func (a *App) CreateAccessControlTemporaryAccesses(rctx request.CTX, req model.AccessControlTemporaryAccessCreateRequest, createdBy string) ([]*model.AccessControlTemporaryAccess, *model.AppError) {
	if createdBy == "" || !model.IsValidId(createdBy) {
		return nil, model.NewAppError("CreateAccessControlTemporaryAccesses", "app.access_control_temporary_access.create.created_by.app_error", nil, "", http.StatusBadRequest)
	}
	if len(req.Subjects) == 0 {
		return nil, model.NewAppError("CreateAccessControlTemporaryAccesses", "app.access_control_temporary_access.create.subjects.app_error", nil, "", http.StatusBadRequest)
	}
	if len(req.Resources) == 0 {
		return nil, model.NewAppError("CreateAccessControlTemporaryAccesses", "app.access_control_temporary_access.create.resources.app_error", nil, "", http.StatusBadRequest)
	}
	if len(req.Actions) == 0 {
		return nil, model.NewAppError("CreateAccessControlTemporaryAccesses", "app.access_control_temporary_access.create.actions.app_error", nil, "", http.StatusBadRequest)
	}

	now := model.GetMillis()
	if req.ExpiresAt <= now || time.Duration(req.ExpiresAt-now)*time.Millisecond > maxAccessControlTemporaryAccessDuration {
		return nil, model.NewAppError("CreateAccessControlTemporaryAccesses", "app.access_control_temporary_access.create.expires_at.app_error", nil, "", http.StatusBadRequest)
	}

	reason := strings.TrimSpace(req.Reason)
	if reason == "" || len(reason) > model.MaxAccessControlTemporaryAccessReasonLength {
		return nil, model.NewAppError("CreateAccessControlTemporaryAccesses", "app.access_control_temporary_access.create.reason.app_error", nil, "", http.StatusBadRequest)
	}

	inviteMode := req.InviteMode
	if inviteMode == "" {
		inviteMode = model.AccessControlTemporaryAccessInviteModePrompt
	}
	switch inviteMode {
	case model.AccessControlTemporaryAccessInviteModeNone, model.AccessControlTemporaryAccessInviteModePrompt:
	default:
		return nil, model.NewAppError("CreateAccessControlTemporaryAccesses", "app.access_control_temporary_access.create.invite_mode.app_error", nil, "", http.StatusBadRequest)
	}

	for _, subject := range req.Subjects {
		if subject.Type != model.AccessControlTemporaryAccessSubjectTypeUser || !model.IsValidId(subject.ID) {
			return nil, model.NewAppError("CreateAccessControlTemporaryAccesses", "app.access_control_temporary_access.create.subject.app_error", nil, "", http.StatusBadRequest)
		}
		user, appErr := a.GetUser(subject.ID)
		if appErr != nil {
			return nil, appErr
		}
		if user.DeleteAt != 0 {
			return nil, model.NewAppError("CreateAccessControlTemporaryAccesses", "app.access_control_temporary_access.create.deleted_user.app_error", nil, "", http.StatusBadRequest)
		}
	}

	for _, resource := range req.Resources {
		if appErr := a.validateAccessControlTemporaryAccessResource(rctx, resource); appErr != nil {
			return nil, appErr
		}
	}

	for _, action := range req.Actions {
		if action != model.AccessControlPolicyActionMembership && !model.IsPermissionAction(action) {
			return nil, model.NewAppError("CreateAccessControlTemporaryAccesses", "app.access_control_temporary_access.create.action.app_error", nil, "", http.StatusBadRequest)
		}
	}

	temporaryAccesses := make([]*model.AccessControlTemporaryAccess, 0, len(req.Subjects)*len(req.Resources)*len(req.Actions))
	for _, subject := range req.Subjects {
		for _, resource := range req.Resources {
			for _, action := range req.Actions {
				temporaryAccesses = append(temporaryAccesses, &model.AccessControlTemporaryAccess{
					SubjectType:  subject.Type,
					SubjectID:    subject.ID,
					ResourceType: resource.Type,
					ResourceID:   resource.ID,
					Action:       action,
					Reason:       reason,
					InviteMode:   inviteMode,
					ExpiresAt:    req.ExpiresAt,
					CreatedBy:    createdBy,
				})
			}
		}
	}

	saved, err := a.Srv().Store().AccessControlTemporaryAccess().Save(rctx, temporaryAccesses)
	if err != nil {
		return nil, model.NewAppError("CreateAccessControlTemporaryAccesses", "app.access_control_temporary_access.create.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	saved, appErr := a.activateAccessControlTemporaryAccessMemberships(rctx, saved)
	if appErr != nil {
		return nil, appErr
	}

	a.postAccessControlTemporaryAccessChannelMessages(rctx, saved, createdBy)
	a.publishAccessControlTemporaryAccessPrompts(saved)

	return saved, nil
}

func (a *App) postAccessControlTemporaryAccessChannelMessages(rctx request.CTX, temporaryAccesses []*model.AccessControlTemporaryAccess, createdBy string) {
	for _, temporaryAccess := range temporaryAccesses {
		if temporaryAccess.SubjectType != model.AccessControlTemporaryAccessSubjectTypeUser ||
			temporaryAccess.Action != model.AccessControlPolicyActionMembership {
			continue
		}

		user, appErr := a.GetUser(temporaryAccess.SubjectID)
		if appErr != nil {
			rctx.Logger().Warn("Failed to load temporary access subject for channel system post",
				mlog.String("temporary_access_id", temporaryAccess.ID),
				mlog.String("subject_id", temporaryAccess.SubjectID),
				mlog.Err(appErr),
			)
			continue
		}

		channel, appErr := a.getAccessControlTemporaryAccessMessageChannel(rctx, temporaryAccess)
		if appErr != nil {
			rctx.Logger().Warn("Failed to load temporary access notification channel for system post",
				mlog.String("temporary_access_id", temporaryAccess.ID),
				mlog.String("resource_type", temporaryAccess.ResourceType),
				mlog.String("resource_id", temporaryAccess.ResourceID),
				mlog.Err(appErr),
			)
			continue
		}

		post := &model.Post{
			ChannelId: channel.Id,
			UserId:    createdBy,
			Type:      model.PostTypeAccessControlTemporaryAccess,
			Message: fmt.Sprintf(
				"@%s has been temporarily invited until %s. Reason: %s",
				user.Username,
				time.UnixMilli(temporaryAccess.ExpiresAt).Format(time.RFC1123),
				temporaryAccess.Reason,
			),
			Props: model.StringInterface{
				"userId":              user.Id,
				"username":            user.Username,
				"expiresAt":           temporaryAccess.ExpiresAt,
				"reason":              temporaryAccess.Reason,
				"temporary_access_id": temporaryAccess.ID,
				"createdBy":           createdBy,
				"temporaryInvite":     true,
			},
		}

		if _, _, appErr = a.CreatePost(rctx, post, channel, model.CreatePostFlags{SetOnline: true}); appErr != nil {
			rctx.Logger().Warn("Failed to create temporary access channel system post",
				mlog.String("temporary_access_id", temporaryAccess.ID),
				mlog.String("channel_id", channel.Id),
				mlog.String("subject_id", user.Id),
				mlog.Err(appErr),
			)
		}
	}
}

func (a *App) getAccessControlTemporaryAccessMessageChannel(rctx request.CTX, temporaryAccess *model.AccessControlTemporaryAccess) (*model.Channel, *model.AppError) {
	switch temporaryAccess.ResourceType {
	case model.AccessControlTemporaryAccessResourceTypeChannel:
		return a.GetChannel(rctx, temporaryAccess.ResourceID)
	case model.AccessControlTemporaryAccessResourceTypeTeam:
		return a.GetChannelByName(rctx, model.DefaultChannelName, temporaryAccess.ResourceID, false)
	default:
		return nil, model.NewAppError("getAccessControlTemporaryAccessMessageChannel", "app.access_control_temporary_access.resource_type.app_error", nil, "", http.StatusBadRequest)
	}
}

func (a *App) SearchAccessControlTemporaryAccesses(rctx request.CTX, opts model.AccessControlTemporaryAccessSearch) ([]*model.AccessControlTemporaryAccess, int64, *model.AppError) {
	temporaryAccesses, total, err := a.Srv().Store().AccessControlTemporaryAccess().Search(rctx, opts)
	if err != nil {
		return nil, 0, model.NewAppError("SearchAccessControlTemporaryAccesses", "app.access_control_temporary_access.search.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return temporaryAccesses, total, nil
}

func (a *App) RevokeAccessControlTemporaryAccess(rctx request.CTX, id string, deletedBy string) (*model.AccessControlTemporaryAccess, *model.AppError) {
	if !model.IsValidId(id) {
		return nil, model.NewAppError("RevokeAccessControlTemporaryAccess", "app.access_control_temporary_access.revoke.id.app_error", nil, "", http.StatusBadRequest)
	}
	if deletedBy == "" || !model.IsValidId(deletedBy) {
		return nil, model.NewAppError("RevokeAccessControlTemporaryAccess", "app.access_control_temporary_access.revoke.deleted_by.app_error", nil, "", http.StatusBadRequest)
	}

	temporaryAccess, err := a.Srv().Store().AccessControlTemporaryAccess().Get(rctx, id)
	if err != nil {
		var nfErr *store.ErrNotFound
		if errors.As(err, &nfErr) {
			return nil, model.NewAppError("RevokeAccessControlTemporaryAccess", "app.access_control_temporary_access.revoke.not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
		}
		return nil, model.NewAppError("RevokeAccessControlTemporaryAccess", "app.access_control_temporary_access.revoke.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	now := model.GetMillis()
	shouldRemoveMembership := temporaryAccess.DeleteAt == 0 && temporaryAccess.ExpiresAt > now && temporaryAccess.MembershipCreated
	if shouldRemoveMembership {
		if appErr := a.removeAccessControlTemporaryAccessMembership(rctx, temporaryAccess); appErr != nil {
			return nil, appErr
		}
	}

	revoked, err := a.Srv().Store().AccessControlTemporaryAccess().Revoke(rctx, id, now, deletedBy)
	if err != nil {
		var nfErr *store.ErrNotFound
		if errors.As(err, &nfErr) {
			return nil, model.NewAppError("RevokeAccessControlTemporaryAccess", "app.access_control_temporary_access.revoke.not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
		}
		return nil, model.NewAppError("RevokeAccessControlTemporaryAccess", "app.access_control_temporary_access.revoke.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if shouldRemoveMembership {
		a.publishAccessControlTemporaryAccessExpired(revoked)
	}

	return revoked, nil
}

func (a *App) GetActiveAccessControlTemporaryAccessesForUser(rctx request.CTX, userID string) ([]*model.AccessControlTemporaryAccess, *model.AppError) {
	if !model.IsValidId(userID) {
		return nil, model.NewAppError("GetActiveAccessControlTemporaryAccessesForUser", "app.access_control_temporary_access.user.id.app_error", nil, "", http.StatusBadRequest)
	}

	temporaryAccesses, _, err := a.Srv().Store().AccessControlTemporaryAccess().Search(rctx, model.AccessControlTemporaryAccessSearch{
		SubjectType: model.AccessControlTemporaryAccessSubjectTypeUser,
		SubjectID:   userID,
		Status:      model.AccessControlTemporaryAccessStatusActive,
		PerPage:     200,
	})
	if err != nil {
		return nil, model.NewAppError("GetActiveAccessControlTemporaryAccessesForUser", "app.access_control_temporary_access.user.search.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return temporaryAccesses, nil
}

func (a *App) AcceptAccessControlTemporaryAccess(rctx request.CTX, id string, userID string) (*model.AccessControlTemporaryAccess, *model.AppError) {
	if !model.IsValidId(id) || !model.IsValidId(userID) {
		return nil, model.NewAppError("AcceptAccessControlTemporaryAccess", "app.access_control_temporary_access.accept.id.app_error", nil, "", http.StatusBadRequest)
	}

	temporaryAccess, err := a.Srv().Store().AccessControlTemporaryAccess().Get(rctx, id)
	if err != nil {
		var nfErr *store.ErrNotFound
		if errors.As(err, &nfErr) {
			return nil, model.NewAppError("AcceptAccessControlTemporaryAccess", "app.access_control_temporary_access.accept.not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
		}
		return nil, model.NewAppError("AcceptAccessControlTemporaryAccess", "app.access_control_temporary_access.accept.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if temporaryAccess.SubjectType != model.AccessControlTemporaryAccessSubjectTypeUser || temporaryAccess.SubjectID != userID || temporaryAccess.DeleteAt != 0 || temporaryAccess.ExpiresAt <= model.GetMillis() {
		return nil, model.NewAppError("AcceptAccessControlTemporaryAccess", "app.access_control_temporary_access.accept.invalid.app_error", nil, "", http.StatusForbidden)
	}
	if temporaryAccess.Action != model.AccessControlPolicyActionMembership {
		return nil, model.NewAppError("AcceptAccessControlTemporaryAccess", "app.access_control_temporary_access.accept.action.app_error", nil, "", http.StatusBadRequest)
	}

	updated, err := a.Srv().Store().AccessControlTemporaryAccess().MarkAccepted(rctx, temporaryAccess.ID, model.GetMillis(), temporaryAccess.JoinedAt, temporaryAccess.MembershipCreated)
	if err != nil {
		return nil, model.NewAppError("AcceptAccessControlTemporaryAccess", "app.access_control_temporary_access.accept.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return updated, nil
}

func (a *App) activateAccessControlTemporaryAccessMemberships(rctx request.CTX, temporaryAccesses []*model.AccessControlTemporaryAccess) ([]*model.AccessControlTemporaryAccess, *model.AppError) {
	activated := make([]*model.AccessControlTemporaryAccess, 0, len(temporaryAccesses))
	for _, temporaryAccess := range temporaryAccesses {
		if temporaryAccess.SubjectType != model.AccessControlTemporaryAccessSubjectTypeUser || temporaryAccess.Action != model.AccessControlPolicyActionMembership {
			activated = append(activated, temporaryAccess)
			continue
		}

		membershipCreated, teamMembershipCreated, appErr := a.ensureAccessControlTemporaryAccessMembership(rctx, temporaryAccess)
		if appErr != nil {
			return nil, appErr
		}

		updated, err := a.Srv().Store().AccessControlTemporaryAccess().MarkJoined(rctx, temporaryAccess.ID, model.GetMillis(), membershipCreated, teamMembershipCreated)
		if err != nil {
			return nil, model.NewAppError("activateAccessControlTemporaryAccessMemberships", "app.access_control_temporary_access.activate.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		activated = append(activated, updated)
	}

	return activated, nil
}

func (a *App) ensureAccessControlTemporaryAccessMembership(rctx request.CTX, temporaryAccess *model.AccessControlTemporaryAccess) (bool, bool, *model.AppError) {
	switch temporaryAccess.ResourceType {
	case model.AccessControlTemporaryAccessResourceTypeTeam:
		created, appErr := a.ensureAccessControlTemporaryAccessTeamMembership(rctx, temporaryAccess.ResourceID, temporaryAccess.SubjectID)
		return created, false, appErr
	case model.AccessControlTemporaryAccessResourceTypeChannel:
		channel, appErr := a.GetChannel(rctx, temporaryAccess.ResourceID)
		if appErr != nil {
			return false, false, appErr
		}
		teamMembershipCreated := false
		if channel.TeamId != "" {
			teamMembershipCreated, appErr = a.ensureAccessControlTemporaryAccessTeamMembership(rctx, channel.TeamId, temporaryAccess.SubjectID)
			if appErr != nil {
				return false, false, appErr
			}
		}
		channelMembershipCreated, appErr := a.ensureAccessControlTemporaryAccessChannelMembership(rctx, channel, temporaryAccess.SubjectID)
		return channelMembershipCreated, teamMembershipCreated, appErr
	default:
		return false, false, model.NewAppError("ensureAccessControlTemporaryAccessMembership", "app.access_control_temporary_access.resource_type.app_error", nil, "", http.StatusBadRequest)
	}
}

func (a *App) ensureAccessControlTemporaryAccessTeamMembership(rctx request.CTX, teamID string, userID string) (bool, *model.AppError) {
	member, err := a.Srv().Store().Team().GetMember(rctx, teamID, userID)
	if err == nil && member.DeleteAt == 0 {
		return false, nil
	}
	var nfErr *store.ErrNotFound
	if err != nil && !errors.As(err, &nfErr) {
		return false, model.NewAppError("ensureAccessControlTemporaryAccessTeamMembership", "app.team.get_member.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if _, appErr := a.AddTeamMember(rctx, teamID, userID); appErr != nil {
		return false, appErr
	}
	return true, nil
}

func (a *App) ensureAccessControlTemporaryAccessChannelMembership(rctx request.CTX, channel *model.Channel, userID string) (bool, *model.AppError) {
	if _, err := a.Srv().Store().Channel().GetMember(rctx, channel.Id, userID); err == nil {
		return false, nil
	} else if nfErr := new(store.ErrNotFound); !errors.As(err, &nfErr) {
		return false, model.NewAppError("ensureAccessControlTemporaryAccessChannelMembership", "app.channel.get_member.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if _, appErr := a.AddChannelMember(rctx, userID, channel, ChannelMemberOpts{SkipTeamMemberIntegrityCheck: true}); appErr != nil {
		return false, appErr
	}
	return true, nil
}

func (a *App) publishAccessControlTemporaryAccessPrompts(temporaryAccesses []*model.AccessControlTemporaryAccess) {
	temporaryAccessesByUser := make(map[string][]*model.AccessControlTemporaryAccess)
	for _, temporaryAccess := range temporaryAccesses {
		if temporaryAccess.InviteMode != model.AccessControlTemporaryAccessInviteModePrompt || temporaryAccess.SubjectType != model.AccessControlTemporaryAccessSubjectTypeUser {
			continue
		}
		temporaryAccessesByUser[temporaryAccess.SubjectID] = append(temporaryAccessesByUser[temporaryAccess.SubjectID], temporaryAccess)
	}

	for userID, userTemporaryAccesses := range temporaryAccessesByUser {
		if len(userTemporaryAccesses) == 0 {
			continue
		}

		message := model.NewWebSocketEvent(model.WebsocketEventAccessControlTemporaryAccessPrompt, "", "", userID, nil, "")
		message.Add("temporary_access", userTemporaryAccesses[0])
		message.Add("temporary_accesses", userTemporaryAccesses)
		a.Publish(message)
	}
}

func (a *App) publishAccessControlTemporaryAccessExpired(temporaryAccess *model.AccessControlTemporaryAccess) {
	if temporaryAccess.SubjectType != model.AccessControlTemporaryAccessSubjectTypeUser {
		return
	}
	message := model.NewWebSocketEvent(model.WebsocketEventAccessControlTemporaryAccessExpired, "", "", temporaryAccess.SubjectID, nil, "")
	message.Add("temporary_access", temporaryAccess)
	a.Publish(message)
}

func (a *App) ExpireAccessControlTemporaryAccessesBatch(rctx request.CTX, now int64, limit int) (int64, int64, *model.AppError) {
	if now == 0 {
		now = model.GetMillis()
	}
	if limit <= 0 {
		return 0, 0, model.NewAppError("ExpireAccessControlTemporaryAccessesBatch", "app.access_control_temporary_access.expire.limit.app_error", nil, "", http.StatusBadRequest)
	}

	temporaryAccesses, err := a.Srv().Store().AccessControlTemporaryAccess().GetExpiredBatch(rctx, now, limit)
	if err != nil {
		return 0, 0, model.NewAppError("ExpireAccessControlTemporaryAccessesBatch", "app.access_control_temporary_access.expire.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if len(temporaryAccesses) == 0 {
		return 0, 0, nil
	}

	ids := make([]string, 0, len(temporaryAccesses))
	removedTemporaryAccesses := make([]*model.AccessControlTemporaryAccess, 0, len(temporaryAccesses))
	var removedMemberships int64
	for _, temporaryAccess := range temporaryAccesses {
		if temporaryAccess.MembershipCreated {
			if appErr := a.removeAccessControlTemporaryAccessMembership(rctx, temporaryAccess); appErr != nil {
				rctx.Logger().Warn("Failed to remove expired temporaryAccess membership",
					mlog.String("temporary_access_id", temporaryAccess.ID),
					mlog.String("resource_type", temporaryAccess.ResourceType),
					mlog.String("resource_id", temporaryAccess.ResourceID),
					mlog.String("subject_id", temporaryAccess.SubjectID),
					mlog.Err(appErr),
				)
				return 0, removedMemberships, appErr
			}
			removedTemporaryAccesses = append(removedTemporaryAccesses, temporaryAccess)
			removedMemberships++
		}
		ids = append(ids, temporaryAccess.ID)
	}

	deleted, err := a.Srv().Store().AccessControlTemporaryAccess().DeleteByIDs(rctx, ids)
	if err != nil {
		return 0, removedMemberships, model.NewAppError("ExpireAccessControlTemporaryAccessesBatch", "app.access_control_temporary_access.expire.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	for _, temporaryAccess := range removedTemporaryAccesses {
		a.publishAccessControlTemporaryAccessExpired(temporaryAccess)
	}

	return deleted, removedMemberships, nil
}

func (a *App) removeAccessControlTemporaryAccessMembership(rctx request.CTX, temporaryAccess *model.AccessControlTemporaryAccess) *model.AppError {
	if temporaryAccess.SubjectType != model.AccessControlTemporaryAccessSubjectTypeUser {
		return nil
	}
	switch temporaryAccess.ResourceType {
	case model.AccessControlTemporaryAccessResourceTypeTeam:
		return a.RemoveUserFromTeam(rctx, temporaryAccess.ResourceID, temporaryAccess.SubjectID, temporaryAccess.SubjectID)
	case model.AccessControlTemporaryAccessResourceTypeChannel:
		if temporaryAccess.TeamMembershipCreated {
			channel, appErr := a.GetChannel(rctx, temporaryAccess.ResourceID)
			if appErr != nil {
				return appErr
			}
			if channel.TeamId != "" {
				return a.RemoveUserFromTeam(rctx, channel.TeamId, temporaryAccess.SubjectID, temporaryAccess.SubjectID)
			}
		}
		channel, appErr := a.GetChannel(rctx, temporaryAccess.ResourceID)
		if appErr != nil {
			return appErr
		}
		return a.RemoveUserFromChannel(rctx, temporaryAccess.SubjectID, temporaryAccess.SubjectID, channel)
	default:
		return nil
	}
}

func (a *App) validateAccessControlTemporaryAccessResource(rctx request.CTX, resource model.AccessControlTemporaryAccessResource) *model.AppError {
	if !model.IsValidId(resource.ID) {
		return model.NewAppError("CreateAccessControlTemporaryAccesses", "app.access_control_temporary_access.create.resource_id.app_error", nil, "", http.StatusBadRequest)
	}

	switch resource.Type {
	case model.AccessControlTemporaryAccessResourceTypeTeam:
		team, appErr := a.GetTeam(resource.ID)
		if appErr != nil {
			return appErr
		}
		if team.DeleteAt != 0 {
			return model.NewAppError("CreateAccessControlTemporaryAccesses", "app.access_control_temporary_access.create.deleted_team.app_error", nil, "", http.StatusBadRequest)
		}
	case model.AccessControlTemporaryAccessResourceTypeChannel:
		channel, appErr := a.GetChannel(rctx, resource.ID)
		if appErr != nil {
			return appErr
		}
		if channel.DeleteAt != 0 {
			return model.NewAppError("CreateAccessControlTemporaryAccesses", "app.access_control_temporary_access.create.deleted_channel.app_error", nil, "", http.StatusBadRequest)
		}
	default:
		return model.NewAppError("CreateAccessControlTemporaryAccesses", "app.access_control_temporary_access.create.resource_type.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}
