// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func (a *App) HasActiveAccessControlBypassForRequest(rctx request.CTX, accessRequest model.AccessRequest) (bool, *model.AppError) {
	if accessRequest.Subject.Type != model.AccessControlBypassSubjectTypeUser {
		return false, nil
	}
	if accessRequest.Subject.ID == "" || accessRequest.Resource.ID == "" || accessRequest.Action == "" {
		return false, nil
	}

	allowed, appErr := a.hasActiveAccessControlBypass(rctx, model.AccessControlBypassActiveCheck{
		SubjectType:  model.AccessControlBypassSubjectTypeUser,
		SubjectID:    accessRequest.Subject.ID,
		ResourceType: accessRequest.Resource.Type,
		ResourceID:   accessRequest.Resource.ID,
		Action:       accessRequest.Action,
	})
	if appErr != nil || allowed {
		return allowed, appErr
	}

	if accessRequest.Resource.Type != model.AccessControlBypassResourceTypeChannel {
		return false, nil
	}

	channel, channelErr := a.GetChannel(rctx, accessRequest.Resource.ID)
	if channelErr != nil {
		if channelErr.StatusCode == http.StatusNotFound {
			return false, nil
		}
		return false, channelErr
	}
	if channel.TeamId == "" {
		return false, nil
	}

	return a.hasActiveAccessControlBypass(rctx, model.AccessControlBypassActiveCheck{
		SubjectType:  model.AccessControlBypassSubjectTypeUser,
		SubjectID:    accessRequest.Subject.ID,
		ResourceType: model.AccessControlBypassResourceTypeTeam,
		ResourceID:   channel.TeamId,
		Action:       accessRequest.Action,
	})
}

func (a *App) hasActiveAccessControlBypass(rctx request.CTX, check model.AccessControlBypassActiveCheck) (bool, *model.AppError) {
	allowed, err := a.Srv().Store().AccessControlBypass().HasActive(rctx, check)
	if err != nil {
		var invalid *store.ErrInvalidInput
		if errors.As(err, &invalid) {
			return false, model.NewAppError("HasActiveAccessControlBypassForRequest", "app.access_control_bypass.has_active.invalid.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		}
		return false, model.NewAppError("HasActiveAccessControlBypassForRequest", "app.access_control_bypass.has_active.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return allowed, nil
}
