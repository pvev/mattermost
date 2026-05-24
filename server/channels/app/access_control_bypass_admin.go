// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

const maxAccessControlBypassDuration = 7 * 24 * time.Hour

func (a *App) CreateAccessControlBypasses(rctx request.CTX, req model.AccessControlBypassCreateRequest, createdBy string) ([]*model.AccessControlBypass, *model.AppError) {
	if createdBy == "" || !model.IsValidId(createdBy) {
		return nil, model.NewAppError("CreateAccessControlBypasses", "app.access_control_bypass.create.created_by.app_error", nil, "", http.StatusBadRequest)
	}
	if len(req.Subjects) == 0 {
		return nil, model.NewAppError("CreateAccessControlBypasses", "app.access_control_bypass.create.subjects.app_error", nil, "", http.StatusBadRequest)
	}
	if len(req.Resources) == 0 {
		return nil, model.NewAppError("CreateAccessControlBypasses", "app.access_control_bypass.create.resources.app_error", nil, "", http.StatusBadRequest)
	}
	if len(req.Actions) == 0 {
		return nil, model.NewAppError("CreateAccessControlBypasses", "app.access_control_bypass.create.actions.app_error", nil, "", http.StatusBadRequest)
	}

	now := model.GetMillis()
	if req.ExpiresAt <= now || time.Duration(req.ExpiresAt-now)*time.Millisecond > maxAccessControlBypassDuration {
		return nil, model.NewAppError("CreateAccessControlBypasses", "app.access_control_bypass.create.expires_at.app_error", nil, "", http.StatusBadRequest)
	}

	reason := strings.TrimSpace(req.Reason)
	if reason == "" || len(reason) > model.MaxAccessControlBypassReasonLength {
		return nil, model.NewAppError("CreateAccessControlBypasses", "app.access_control_bypass.create.reason.app_error", nil, "", http.StatusBadRequest)
	}

	inviteMode := req.InviteMode
	if inviteMode == "" {
		inviteMode = model.AccessControlBypassInviteModeNone
	}
	switch inviteMode {
	case model.AccessControlBypassInviteModeNone, model.AccessControlBypassInviteModePrompt:
	default:
		return nil, model.NewAppError("CreateAccessControlBypasses", "app.access_control_bypass.create.invite_mode.app_error", nil, "", http.StatusBadRequest)
	}

	for _, subject := range req.Subjects {
		if subject.Type != model.AccessControlBypassSubjectTypeUser || !model.IsValidId(subject.ID) {
			return nil, model.NewAppError("CreateAccessControlBypasses", "app.access_control_bypass.create.subject.app_error", nil, "", http.StatusBadRequest)
		}
		user, appErr := a.GetUser(subject.ID)
		if appErr != nil {
			return nil, appErr
		}
		if user.DeleteAt != 0 {
			return nil, model.NewAppError("CreateAccessControlBypasses", "app.access_control_bypass.create.deleted_user.app_error", nil, "", http.StatusBadRequest)
		}
	}

	for _, resource := range req.Resources {
		if appErr := a.validateAccessControlBypassResource(rctx, resource); appErr != nil {
			return nil, appErr
		}
	}

	for _, action := range req.Actions {
		if action != model.AccessControlPolicyActionMembership && !model.IsPermissionAction(action) {
			return nil, model.NewAppError("CreateAccessControlBypasses", "app.access_control_bypass.create.action.app_error", nil, "", http.StatusBadRequest)
		}
	}

	bypasses := make([]*model.AccessControlBypass, 0, len(req.Subjects)*len(req.Resources)*len(req.Actions))
	for _, subject := range req.Subjects {
		for _, resource := range req.Resources {
			for _, action := range req.Actions {
				bypasses = append(bypasses, &model.AccessControlBypass{
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

	saved, err := a.Srv().Store().AccessControlBypass().Save(rctx, bypasses)
	if err != nil {
		return nil, model.NewAppError("CreateAccessControlBypasses", "app.access_control_bypass.create.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	a.publishAccessControlBypassPrompts(saved)

	return saved, nil
}

func (a *App) SearchAccessControlBypasses(rctx request.CTX, opts model.AccessControlBypassSearch) ([]*model.AccessControlBypass, int64, *model.AppError) {
	bypasses, total, err := a.Srv().Store().AccessControlBypass().Search(rctx, opts)
	if err != nil {
		return nil, 0, model.NewAppError("SearchAccessControlBypasses", "app.access_control_bypass.search.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return bypasses, total, nil
}

func (a *App) RevokeAccessControlBypass(rctx request.CTX, id string, deletedBy string) (*model.AccessControlBypass, *model.AppError) {
	if !model.IsValidId(id) {
		return nil, model.NewAppError("RevokeAccessControlBypass", "app.access_control_bypass.revoke.id.app_error", nil, "", http.StatusBadRequest)
	}
	if deletedBy == "" || !model.IsValidId(deletedBy) {
		return nil, model.NewAppError("RevokeAccessControlBypass", "app.access_control_bypass.revoke.deleted_by.app_error", nil, "", http.StatusBadRequest)
	}

	bypass, err := a.Srv().Store().AccessControlBypass().Revoke(rctx, id, model.GetMillis(), deletedBy)
	if err != nil {
		var nfErr *store.ErrNotFound
		if errors.As(err, &nfErr) {
			return nil, model.NewAppError("RevokeAccessControlBypass", "app.access_control_bypass.revoke.not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
		}
		return nil, model.NewAppError("RevokeAccessControlBypass", "app.access_control_bypass.revoke.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return bypass, nil
}

func (a *App) GetActiveAccessControlBypassesForUser(rctx request.CTX, userID string) ([]*model.AccessControlBypass, *model.AppError) {
	if !model.IsValidId(userID) {
		return nil, model.NewAppError("GetActiveAccessControlBypassesForUser", "app.access_control_bypass.user.id.app_error", nil, "", http.StatusBadRequest)
	}

	bypasses, _, err := a.Srv().Store().AccessControlBypass().Search(rctx, model.AccessControlBypassSearch{
		SubjectType: model.AccessControlBypassSubjectTypeUser,
		SubjectID:   userID,
		Status:      model.AccessControlBypassStatusActive,
		PerPage:     200,
	})
	if err != nil {
		return nil, model.NewAppError("GetActiveAccessControlBypassesForUser", "app.access_control_bypass.user.search.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return bypasses, nil
}

func (a *App) AcceptAccessControlBypass(rctx request.CTX, id string, userID string) (*model.AccessControlBypass, *model.AppError) {
	if !model.IsValidId(id) || !model.IsValidId(userID) {
		return nil, model.NewAppError("AcceptAccessControlBypass", "app.access_control_bypass.accept.id.app_error", nil, "", http.StatusBadRequest)
	}

	bypass, err := a.Srv().Store().AccessControlBypass().Get(rctx, id)
	if err != nil {
		var nfErr *store.ErrNotFound
		if errors.As(err, &nfErr) {
			return nil, model.NewAppError("AcceptAccessControlBypass", "app.access_control_bypass.accept.not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
		}
		return nil, model.NewAppError("AcceptAccessControlBypass", "app.access_control_bypass.accept.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if bypass.SubjectType != model.AccessControlBypassSubjectTypeUser || bypass.SubjectID != userID || bypass.DeleteAt != 0 || bypass.ExpiresAt <= model.GetMillis() {
		return nil, model.NewAppError("AcceptAccessControlBypass", "app.access_control_bypass.accept.invalid.app_error", nil, "", http.StatusForbidden)
	}
	if bypass.Action != model.AccessControlPolicyActionMembership {
		return nil, model.NewAppError("AcceptAccessControlBypass", "app.access_control_bypass.accept.action.app_error", nil, "", http.StatusBadRequest)
	}

	now := model.GetMillis()
	membershipCreated := false
	switch bypass.ResourceType {
	case model.AccessControlBypassResourceTypeTeam:
		created, appErr := a.ensureAccessControlBypassTeamMembership(rctx, bypass.ResourceID, userID)
		if appErr != nil {
			return nil, appErr
		}
		membershipCreated = created
	case model.AccessControlBypassResourceTypeChannel:
		channel, appErr := a.GetChannel(rctx, bypass.ResourceID)
		if appErr != nil {
			return nil, appErr
		}
		if channel.TeamId != "" {
			if _, appErr = a.ensureAccessControlBypassTeamMembership(rctx, channel.TeamId, userID); appErr != nil {
				return nil, appErr
			}
		}
		created, appErr := a.ensureAccessControlBypassChannelMembership(rctx, channel, userID)
		if appErr != nil {
			return nil, appErr
		}
		membershipCreated = created
	default:
		return nil, model.NewAppError("AcceptAccessControlBypass", "app.access_control_bypass.accept.resource_type.app_error", nil, "", http.StatusBadRequest)
	}

	updated, err := a.Srv().Store().AccessControlBypass().MarkAccepted(rctx, bypass.ID, now, now, membershipCreated)
	if err != nil {
		return nil, model.NewAppError("AcceptAccessControlBypass", "app.access_control_bypass.accept.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return updated, nil
}

func (a *App) ensureAccessControlBypassTeamMembership(rctx request.CTX, teamID string, userID string) (bool, *model.AppError) {
	member, err := a.Srv().Store().Team().GetMember(rctx, teamID, userID)
	if err == nil && member.DeleteAt == 0 {
		return false, nil
	}
	var nfErr *store.ErrNotFound
	if err != nil && !errors.As(err, &nfErr) {
		return false, model.NewAppError("ensureAccessControlBypassTeamMembership", "app.team.get_member.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if _, appErr := a.AddTeamMember(rctx, teamID, userID); appErr != nil {
		return false, appErr
	}
	return true, nil
}

func (a *App) ensureAccessControlBypassChannelMembership(rctx request.CTX, channel *model.Channel, userID string) (bool, *model.AppError) {
	if _, err := a.Srv().Store().Channel().GetMember(rctx, channel.Id, userID); err == nil {
		return false, nil
	} else if nfErr := new(store.ErrNotFound); !errors.As(err, &nfErr) {
		return false, model.NewAppError("ensureAccessControlBypassChannelMembership", "app.channel.get_member.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if _, appErr := a.AddChannelMember(rctx, userID, channel, ChannelMemberOpts{SkipTeamMemberIntegrityCheck: true}); appErr != nil {
		return false, appErr
	}
	return true, nil
}

func (a *App) publishAccessControlBypassPrompts(bypasses []*model.AccessControlBypass) {
	for _, bypass := range bypasses {
		if bypass.InviteMode != model.AccessControlBypassInviteModePrompt || bypass.SubjectType != model.AccessControlBypassSubjectTypeUser {
			continue
		}
		bypassJSON, err := json.Marshal(bypass)
		if err != nil {
			continue
		}
		message := model.NewWebSocketEvent(model.WebsocketEventAccessControlBypassPrompt, "", "", bypass.SubjectID, nil, "")
		message.Add("bypass", string(bypassJSON))
		a.Publish(message)
	}
}

func (a *App) ExpireAccessControlBypassesBatch(rctx request.CTX, now int64, limit int) (int64, int64, *model.AppError) {
	if now == 0 {
		now = model.GetMillis()
	}
	if limit <= 0 {
		return 0, 0, model.NewAppError("ExpireAccessControlBypassesBatch", "app.access_control_bypass.expire.limit.app_error", nil, "", http.StatusBadRequest)
	}

	bypasses, err := a.Srv().Store().AccessControlBypass().GetExpiredBatch(rctx, now, limit)
	if err != nil {
		return 0, 0, model.NewAppError("ExpireAccessControlBypassesBatch", "app.access_control_bypass.expire.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if len(bypasses) == 0 {
		return 0, 0, nil
	}

	ids := make([]string, 0, len(bypasses))
	var removedMemberships int64
	for _, bypass := range bypasses {
		if bypass.MembershipCreated {
			if appErr := a.removeAccessControlBypassMembership(rctx, bypass); appErr != nil {
				rctx.Logger().Warn("Failed to remove expired access control bypass membership",
					mlog.String("bypass_id", bypass.ID),
					mlog.String("resource_type", bypass.ResourceType),
					mlog.String("resource_id", bypass.ResourceID),
					mlog.String("subject_id", bypass.SubjectID),
					mlog.Err(appErr),
				)
				return 0, removedMemberships, appErr
			}
			removedMemberships++
		}
		ids = append(ids, bypass.ID)
	}

	deleted, err := a.Srv().Store().AccessControlBypass().DeleteByIDs(rctx, ids)
	if err != nil {
		return 0, removedMemberships, model.NewAppError("ExpireAccessControlBypassesBatch", "app.access_control_bypass.expire.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return deleted, removedMemberships, nil
}

func (a *App) removeAccessControlBypassMembership(rctx request.CTX, bypass *model.AccessControlBypass) *model.AppError {
	if bypass.SubjectType != model.AccessControlBypassSubjectTypeUser {
		return nil
	}
	switch bypass.ResourceType {
	case model.AccessControlBypassResourceTypeTeam:
		return a.RemoveUserFromTeam(rctx, bypass.ResourceID, bypass.SubjectID, bypass.SubjectID)
	case model.AccessControlBypassResourceTypeChannel:
		channel, appErr := a.GetChannel(rctx, bypass.ResourceID)
		if appErr != nil {
			return appErr
		}
		return a.RemoveUserFromChannel(rctx, bypass.SubjectID, bypass.SubjectID, channel)
	default:
		return nil
	}
}

func (a *App) validateAccessControlBypassResource(rctx request.CTX, resource model.AccessControlBypassResource) *model.AppError {
	if !model.IsValidId(resource.ID) {
		return model.NewAppError("CreateAccessControlBypasses", "app.access_control_bypass.create.resource_id.app_error", nil, "", http.StatusBadRequest)
	}

	switch resource.Type {
	case model.AccessControlBypassResourceTypeTeam:
		team, appErr := a.GetTeam(resource.ID)
		if appErr != nil {
			return appErr
		}
		if team.DeleteAt != 0 {
			return model.NewAppError("CreateAccessControlBypasses", "app.access_control_bypass.create.deleted_team.app_error", nil, "", http.StatusBadRequest)
		}
	case model.AccessControlBypassResourceTypeChannel:
		channel, appErr := a.GetChannel(rctx, resource.ID)
		if appErr != nil {
			return appErr
		}
		if channel.DeleteAt != 0 {
			return model.NewAppError("CreateAccessControlBypasses", "app.access_control_bypass.create.deleted_channel.app_error", nil, "", http.StatusBadRequest)
		}
	default:
		return model.NewAppError("CreateAccessControlBypasses", "app.access_control_bypass.create.resource_type.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}
