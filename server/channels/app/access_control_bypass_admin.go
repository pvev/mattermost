// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
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
